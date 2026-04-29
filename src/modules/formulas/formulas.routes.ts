import { Router } from 'express';
import { listFormulas, createFormula, getFormulaById, updateFormula, testFormula } from './formulas.controller';
import { authenticateJWT } from '../../middleware/auth';
import { authorizeRole } from '../../middleware/role';
import { validateRequest } from '../../middleware/validate';
import { createFormulaSchema, updateFormulaSchema, testFormulaSchema, formulaIdParamSchema } from './formulas.schema';

const router = Router();
router.use(authenticateJWT, authorizeRole('ADMIN'));

router.get('/', listFormulas);
router.post('/', validateRequest(createFormulaSchema), createFormula);
router.get('/:id', validateRequest(formulaIdParamSchema, 'params'), getFormulaById);
router.patch('/:id', validateRequest(formulaIdParamSchema, 'params'), validateRequest(updateFormulaSchema), updateFormula);
router.post('/:id/test', validateRequest(formulaIdParamSchema, 'params'), validateRequest(testFormulaSchema), testFormula);

export default router;
