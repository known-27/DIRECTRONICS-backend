import { Request, Response } from 'express';
import { tryCatch } from '../../utils/tryCatch';
import { sendSuccess, sendCreated } from '../../utils/response';
import {
  listFormulasService, createFormulaService, getFormulaByIdService,
  updateFormulaService, testFormulaService,
} from './formulas.service';

const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip ?? 'unknown';

export const listFormulas = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const serviceId = req.query.serviceId as string | undefined;
  const formulas = await listFormulasService(serviceId);
  sendSuccess(res, formulas, 'Formulas retrieved');
});

export const createFormula = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const formula = await createFormulaService(req.body, req.user!.sub, getIp(req));
  sendCreated(res, formula, 'Formula created');
});

export const getFormulaById = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const formula = await getFormulaByIdService(req.params.id);
  sendSuccess(res, formula, 'Formula retrieved');
});

export const updateFormula = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const formula = await updateFormulaService(req.params.id, req.body, req.user!.sub, getIp(req));
  sendSuccess(res, formula, 'Formula updated');
});

export const testFormula = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const result = await testFormulaService(req.params.id, req.body, req.user!.sub);
  sendSuccess(res, result, 'Formula test complete');
});
