<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            'customers:read', 'customers:write', 'customers:verify',
            'applications:read', 'applications:write', 'applications:decide',
            'loans:read',
            'disbursements:request', 'disbursements:authorise',
            'payments:read', 'payments:record', 'payments:reverse:request', 'payments:reverse:approve',
            'collections:write',
            'accounting:read',
            'reports:read',
            'settings:manage',
            'tenants:manage',
            'audit:read',
        ];

        foreach ($permissions as $p) {
            Permission::firstOrCreate(['name' => $p, 'guard_name' => 'web']);
        }

        $rolePermissions = [
            'platform_admin' => ['tenants:manage'],
            'institution_admin' => [
                'customers:read', 'customers:write', 'customers:verify',
                'applications:read', 'applications:write', 'applications:decide',
                'loans:read', 'disbursements:request', 'disbursements:authorise',
                'payments:read', 'payments:record', 'payments:reverse:request', 'payments:reverse:approve',
                'collections:write', 'accounting:read', 'reports:read', 'settings:manage', 'audit:read',
            ],
            'credit_officer' => [
                'customers:read', 'customers:write',
                'applications:read', 'applications:write',
                'loans:read', 'disbursements:request',
                'payments:read', 'collections:write', 'reports:read',
            ],
            'credit_manager' => [
                'customers:read', 'customers:write', 'customers:verify',
                'applications:read', 'applications:write', 'applications:decide',
                'loans:read', 'disbursements:request', 'disbursements:authorise',
                'payments:read', 'collections:write', 'reports:read',
            ],
            'cashier' => [
                'customers:read',
                'loans:read', 'disbursements:request',
                'payments:read', 'payments:record', 'payments:reverse:request',
                'collections:write',
            ],
            'accountant' => [
                'customers:read', 'loans:read',
                'payments:read', 'accounting:read', 'reports:read',
            ],
            'auditor' => [
                'customers:read', 'loans:read',
                'payments:read', 'accounting:read', 'reports:read', 'audit:read',
            ],
            'borrower' => [],
        ];

        foreach ($rolePermissions as $roleName => $perms) {
            $role = Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
            $role->syncPermissions($perms);
        }
    }
}
