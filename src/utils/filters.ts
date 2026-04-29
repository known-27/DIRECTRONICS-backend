import { Prisma } from '@prisma/client';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

// ─── Date Range Filter Types ──────────────────────────────────────────────────

export type DateRangeFilter =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'this_quarter'
  | 'this_year'
  | 'custom';

// ─── Fiscal Quarter Calculation ───────────────────────────────────────────────

function getQuarterRange(now: Date): { start: Date; end: Date } {
  const month = now.getMonth(); // 0-indexed
  const year  = now.getFullYear();
  const q      = Math.floor(month / 3); // 0=Q1, 1=Q2, 2=Q3, 3=Q4
  const startMonth = q * 3;
  const endMonth   = startMonth + 2;
  const start = new Date(year, startMonth, 1);
  const end   = new Date(year, endMonth + 1, 0, 23, 59, 59, 999); // last ms of last day
  return { start, end };
}

// ─── Build Prisma date filter from range string ───────────────────────────────

export const buildDateRangeFilter = (
  range?: string,
  customStart?: string,
  customEnd?: string
): Prisma.DateTimeFilter | undefined => {
  if (!range || range === 'all') return undefined;

  const now = new Date();

  switch (range as DateRangeFilter) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { gte: start, lte: end };
    }
    case 'this_week': {
      return {
        gte: startOfWeek(now, { weekStartsOn: 1 }),
        lte: endOfWeek(now,   { weekStartsOn: 1 }),
      };
    }
    case 'this_month': {
      return { gte: startOfMonth(now), lte: endOfMonth(now) };
    }
    case 'this_quarter': {
      const { start, end } = getQuarterRange(now);
      return { gte: start, lte: end };
    }
    case 'this_year': {
      return { gte: startOfYear(now), lte: endOfYear(now) };
    }
    case 'custom': {
      if (!customStart || !customEnd) return undefined;
      const start = new Date(customStart);
      const end   = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return undefined;
      return { gte: start, lte: end };
    }
    default:
      return undefined;
  }
};

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationArgs {
  skip: number;
  take: number;
}

export const buildPaginationArgs = (
  page: number | string = 1,
  limit: number | string = 20
): PaginationArgs => {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  return { skip: (p - 1) * l, take: l };
};

export interface PaginatedResponse<T> {
  data:       T[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export const buildPaginatedResponse = <T>(
  data: T[],
  total: number,
  page: number | string,
  limit: number | string
): PaginatedResponse<T> => {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  return {
    data,
    total,
    page: p,
    limit: l,
    totalPages: Math.ceil(total / l),
  };
};
