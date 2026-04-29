import { Request, Response } from 'express';
import { tryCatch } from '../../utils/tryCatch';
import { sendSuccess, sendCreated } from '../../utils/response';
import {
  listServicesService,
  createServiceService,
  getServiceByIdService,
  updateServiceService,
  deleteServiceService,
  createMappingService,
  deleteMappingService,
} from './services.service';

const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip ?? 'unknown';

export const listServices = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const includeInactive = req.query.all === 'true' && req.user?.role === 'ADMIN';
  const services = await listServicesService(includeInactive);
  sendSuccess(res, services, 'Services retrieved');
});

export const createService = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const service = await createServiceService(req.body, req.user!.sub, getIp(req));
  sendCreated(res, service, 'Service created');
});

export const getServiceById = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const service = await getServiceByIdService(req.params.id);
  sendSuccess(res, service, 'Service retrieved');
});

export const updateService = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const service = await updateServiceService(req.params.id, req.body, req.user!.sub, getIp(req));
  sendSuccess(res, service, 'Service updated');
});

export const deleteService = tryCatch(async (req: Request, res: Response): Promise<void> => {
  await deleteServiceService(req.params.id, req.user!.sub, getIp(req));
  sendSuccess(res, {}, 'Service deactivated');
});

export const createMapping = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const mapping = await createMappingService(req.body, req.user!.sub, getIp(req));
  sendCreated(res, mapping, 'Mapping created');
});

export const deleteMapping = tryCatch(async (req: Request, res: Response): Promise<void> => {
  await deleteMappingService(req.params.id, req.user!.sub, getIp(req));
  sendSuccess(res, {}, 'Mapping removed');
});
