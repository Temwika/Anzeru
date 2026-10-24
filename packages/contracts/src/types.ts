import type { Permission, Role } from './access';

/** Standard API response envelope. */
export interface ApiEnvelope<T> {
  data: T;
  meta: { requestId: string; page?: number; pageSize?: number; total?: number };
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
  meta: { requestId: string };
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  tenantId: string | null;
  tenantName: string | null;
  currency: string;
  timezone: string;
  branchIds: string[];
  permissions: Permission[];
  approvalLimit: string;
  customerId: string | null;
  mfaEnabled: boolean;
}
