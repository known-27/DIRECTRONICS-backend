import { Request, Response } from 'express';
import { tryCatch } from '../../utils/tryCatch';
import { sendSuccess } from '../../utils/response';
import { getAdminDashboardService, getEmployeeDashboardService } from './dashboard.service';

export const getAdminDashboard = tryCatch(async (_req: Request, res: Response): Promise<void> => {
  const data = await getAdminDashboardService();
  sendSuccess(res, data, 'Admin dashboard data');
});

export const getEmployeeDashboard = tryCatch(async (req: Request, res: Response): Promise<void> => {
  const data = await getEmployeeDashboardService(req.user!.sub);
  sendSuccess(res, data, 'Employee dashboard data');
});
