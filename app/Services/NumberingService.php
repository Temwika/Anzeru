<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class NumberingService
{
    private static array $formats = [
        'customer'    => ['CUS-', 6],
        'application' => ['APP-', 6],
        'loan'        => ['LN-',  6],
        'payment'     => ['PAY-', 6],
        'journal'     => ['JNL-', 6],
    ];

    public static function next(string $entity, string $tenantId): string
    {
        [$prefix, $pad] = self::$formats[$entity] ?? [$entity . '-', 6];

        $value = DB::transaction(function () use ($entity, $tenantId) {
            $row = DB::table('counters')
                ->where('tenant_id', $tenantId)
                ->where('key', $entity)
                ->lockForUpdate()
                ->first();

            if ($row) {
                $next = $row->value + 1;
                DB::table('counters')
                    ->where('tenant_id', $tenantId)
                    ->where('key', $entity)
                    ->update(['value' => $next]);
            } else {
                $next = 1;
                DB::table('counters')->insert([
                    'tenant_id' => $tenantId,
                    'key'       => $entity,
                    'value'     => $next,
                ]);
            }

            return $next;
        });

        return $prefix . str_pad((string) $value, $pad, '0', STR_PAD_LEFT);
    }
}
