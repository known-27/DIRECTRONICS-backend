export const CONSTANTS = {
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Token
  ACCESS_TOKEN_COOKIE: 'access_token',
  REFRESH_TOKEN_COOKIE: 'refresh_token',

  // Roles
  ROLES: {
    ADMIN: 'ADMIN',
    EMPLOYEE: 'EMPLOYEE',
  },

  // Project status flow
  PROJECT_STATUS: {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    PAID: 'PAID',
  },

  // Payment status
  PAYMENT_STATUS: {
    PENDING: 'PENDING',
    PROCESSED: 'PROCESSED',
    CANCELLED: 'CANCELLED',
  },

  // Audit actions
  AUDIT_ACTIONS: {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    STATUS_CHANGE: 'STATUS_CHANGE',
    FORMULA_EVAL_FAIL: 'FORMULA_EVAL_FAIL',
    TOKEN_REFRESH: 'TOKEN_REFRESH',
  },
} as const;
