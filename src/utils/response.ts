import { Response } from 'express';

interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

interface ErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = 200,
  meta?: Record<string, unknown>
): Response<SuccessResponse<T>> => {
  const response: SuccessResponse<T> = { success: true, message, data };
  if (meta) response.meta = meta;
  return res.status(statusCode).json(response);
};

export const sendCreated = <T>(
  res: Response,
  data: T,
  message: string = 'Created successfully'
): Response<SuccessResponse<T>> => {
  return sendSuccess(res, data, message, 201);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  errors?: Record<string, string[]>
): Response<ErrorResponse> => {
  const response: ErrorResponse = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  pageSize: number,
  message: string = 'Success'
): Response => {
  return sendSuccess(res, data, message, 200, {
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
};
