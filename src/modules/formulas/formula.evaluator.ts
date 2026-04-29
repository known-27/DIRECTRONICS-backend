import { create, all, MathJsStatic } from 'mathjs';
import { UnprocessableError } from '../../utils/errors';
import { auditLog } from '../audit/auditLog';
import { CONSTANTS } from '../../config/constants';

// Create a sandboxed mathjs instance with safe settings
const math = create(all) as MathJsStatic;

// Disable unsafe functions
math.import(
  {
    import: () => { throw new Error('Function import is disabled'); },
    createUnit: () => { throw new Error('Function createUnit is disabled'); },
  },
  { override: true }
);

interface FormulaVariable {
  key: string;
  label: string;
  type: 'number' | 'string';
  sourceField?: string;
}

export interface EvaluationResult {
  result: number;
  breakdown: Record<string, number | string>;
}

/**
 * Safely evaluates a formula expression using mathjs.
 * Never uses eval() or new Function().
 */
export const evaluateFormula = async (
  expression: string,
  variables: FormulaVariable[],
  values: Record<string, string | number>,
  actorId?: string
): Promise<EvaluationResult> => {
  // Validate all required variables are present
  const missingVars: string[] = [];
  const scope: Record<string, number> = {};

  for (const variable of variables) {
    const rawValue = values[variable.key];

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      missingVars.push(variable.label || variable.key);
      continue;
    }

    const numericValue = Number(rawValue);

    if (isNaN(numericValue)) {
      throw new UnprocessableError(
        `Variable '${variable.label || variable.key}' must be a valid number, got: ${rawValue}`
      );
    }

    scope[variable.key] = numericValue;
  }

  if (missingVars.length > 0) {
    throw new UnprocessableError(
      `Missing required variables: ${missingVars.join(', ')}`
    );
  }

  // Prevent dangerous expressions
  const dangerousPatterns = [
    /import\s*\(/,
    /require\s*\(/,
    /process\./,
    /global\./,
    /eval\s*\(/,
    /Function\s*\(/,
    /__proto__/,
    /constructor/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(expression)) {
      await auditLog({
        userId: actorId,
        action: CONSTANTS.AUDIT_ACTIONS.FORMULA_EVAL_FAIL,
        entity: 'Formula',
        newValue: { expression, reason: 'Dangerous pattern detected' },
      });
      throw new UnprocessableError('Formula contains disallowed patterns');
    }
  }

  try {
    const result = math.evaluate(expression, scope);

    if (typeof result !== 'number' || !isFinite(result)) {
      throw new UnprocessableError(
        `Formula did not produce a valid number. Result: ${result}`
      );
    }

    const roundedResult = Math.round(result);

    if (!isFinite(roundedResult) || isNaN(roundedResult)) {
      throw new UnprocessableError(
        'Formula produced an invalid result (NaN or Infinity). Check the formula and input values.'
      );
    }

    return {
      result: roundedResult,
      breakdown: scope,
    };
  } catch (err) {
    if (err instanceof UnprocessableError) throw err;

    await auditLog({
      userId: actorId,
      action: CONSTANTS.AUDIT_ACTIONS.FORMULA_EVAL_FAIL,
      entity: 'Formula',
      newValue: { expression, error: String(err) },
    });

    throw new UnprocessableError(
      `Formula evaluation failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
};
