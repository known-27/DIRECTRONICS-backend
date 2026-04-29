import { Request, Response } from 'express';
import { tryCatch } from '../../utils/tryCatch';
import { sendSuccess, sendCreated } from '../../utils/response';
import {
  createProjectService,
  listProjectsService,
  getProjectByIdService,
  updateProjectService,
  updateProjectFinishService,
  submitProjectService,
  approveProjectService,
  updateProjectStatusService,
  deleteProjectService,
  checkInvoiceService,
} from './projects.service';

const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip ?? 'unknown';

export const createProject = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const project = await createProjectService(req.body, req.user!.sub, getIp(req));
  sendCreated(res, project, 'Project created');
});

export const listProjects = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const { status, employeeId, serviceId, paymentMode, dateRange, startDate, endDate, page, limit } =
    req.query as Record<string, string | undefined>;
  const result = await listProjectsService(
    req.user!.role as 'ADMIN' | 'EMPLOYEE',
    req.user!.sub,
    { status, employeeId, serviceId, paymentMode, dateRange, startDate, endDate, page, limit }
  );
  sendSuccess(res, result, 'Projects retrieved');
});

export const getProjectById = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const project = await getProjectByIdService(
    req.params.id,
    req.user!.role as 'ADMIN' | 'EMPLOYEE',
    req.user!.sub
  );
  sendSuccess(res, project, 'Project retrieved');
});

export const updateProject = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const project = await updateProjectService(req.params.id, req.body, req.user!.sub, getIp(req));
  sendSuccess(res, project, 'Project updated');
});

export const updateProjectFinish = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const completionImageUrl = (req.body.completionImageUrl as string | undefined) ||
    (req.file ? `/uploads/project-images/${req.params.id}/${req.file.filename}` : undefined);

  const project = await updateProjectFinishService(
    req.params.id,
    req.body,
    completionImageUrl,
    req.user!.sub,
    getIp(req)
  );
  sendSuccess(res, project, 'Project updated with finish details');
});

export const submitProject = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const project = await submitProjectService(req.params.id, req.user!.sub, getIp(req));
  sendSuccess(res, project, 'Project submitted');
});

export const approveProject = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const result = await approveProjectService(req.params.id, req.body, req.user!.sub, getIp(req));
  sendSuccess(res, result, 'Project approved');
});

export const updateProjectStatus = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const project = await updateProjectStatusService(req.params.id, req.body, req.user!.sub, getIp(req));
  sendSuccess(res, project, 'Project status updated');
});

export const deleteProject = tryCatch(async (req: Request, res: Response): Promise<void> => {
  await deleteProjectService(req.params.id, req.user!.sub, getIp(req));
  sendSuccess(res, null, 'Draft project deleted successfully');
});

export const checkInvoice = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const { number } = req.query as { number: string };
  const result = await checkInvoiceService(number ?? '');
  sendSuccess(res, result, result.available ? 'Invoice number is available' : 'Invoice number already in use');
});
