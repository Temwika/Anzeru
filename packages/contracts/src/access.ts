/**
 * Role and permission matrix. The API enforces these on every protected
 * route; the web app uses the same matrix only to decide what to show.
 */
export const ROLES = [
  'platform_admin',
  'institution_admin',
  'credit_officer',
  'credit_manager',
  'cashier',
  'accountant',
  'auditor',
  'borrower',
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  platform_admin: 'Platform super administrator',
  institution_admin: 'Institution administrator',
  credit_officer: 'Credit officer',
  credit_manager: 'Credit manager',
  cashier: 'Cashier / collections officer',
  accountant: 'Accountant',
  auditor: 'Auditor / compliance officer',
  borrower: 'Borrower',
};

export const PERMISSIONS = [
  'tenants:manage',
  'settings:manage',
  'customers:read',
  'customers:write',
  'customers:verify',
  'applications:read',
  'applications:write',
  'applications:decide',
  'loans:read',
  'disbursements:request',
  'disbursements:authorise',
  'payments:read',
  'payments:record',
  'payments:reverse:request',
  'payments:reverse:approve',
  'collections:read',
  'collections:write',
  'accounting:read',
  'reports:read',
  'audit:read',
  'jobs:run',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const READ_ALL: Permission[] = [
  'customers:read',
  'applications:read',
  'loans:read',
  'payments:read',
  'collections:read',
  'accounting:read',
  'reports:read',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  platform_admin: ['tenants:manage', 'audit:read'],
  institution_admin: ['settings:manage', ...READ_ALL, 'audit:read', 'jobs:run'],
  credit_officer: [
    'customers:read',
    'customers:write',
    'applications:read',
    'applications:write',
    'loans:read',
    'disbursements:request',
    'payments:read',
    'collections:read',
    'collections:write',
  ],
  credit_manager: [
    'customers:read',
    'customers:verify',
    'applications:read',
    'applications:decide',
    'loans:read',
    'disbursements:request',
    'payments:read',
    'collections:read',
    'collections:write',
    'reports:read',
  ],
  cashier: [
    'customers:read',
    'loans:read',
    'payments:read',
    'payments:record',
    'payments:reverse:request',
    'collections:read',
    'collections:write',
  ],
  accountant: [
    'customers:read',
    'loans:read',
    'payments:read',
    'disbursements:authorise',
    'payments:reverse:approve',
    'accounting:read',
    'reports:read',
    'jobs:run',
  ],
  auditor: [...READ_ALL, 'audit:read'],
  borrower: [],
};

/** Roles whose data access is limited to the branches assigned to the user. */
export const BRANCH_SCOPED_ROLES: Role[] = ['credit_officer', 'cashier'];

export function permissionsFor(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(role: Role, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}
