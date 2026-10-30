<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;

class AuditService
{
    public static function log(
        string $action,
        string $entityType,
        ?string $entityId,
        array $data = [],
        ?string $tenantId = null,
        ?string $userId = null
    ): void {
        $tenantId = $tenantId ?? (app()->bound('tenant') ? app('tenant')->id : null);
        $userId   = $userId ?? auth()->id();

        $last = DB::table('audit_logs')
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->orderByDesc('seq')
            ->value('hash') ?? '';

        $payload = json_encode([$action, $entityType, $entityId, $data], JSON_UNESCAPED_UNICODE);
        $hash    = hash('sha256', $last . $payload);

        DB::table('audit_logs')->insert([
            'tenant_id'   => $tenantId,
            'user_id'     => $userId,
            'action'      => $action,
            'entity_type' => $entityType,
            'entity_id'   => $entityId,
            'data'        => json_encode($data),
            'ip'          => Request::ip(),
            'prev_hash'   => $last,
            'hash'        => $hash,
            'created_at'  => now(),
        ]);
    }
}
