<?php

namespace App\Services\Finance;

/**
 * All monetary arithmetic uses bcmath with 20-digit internal scale and HALF_UP
 * rounding to 2dp at the boundary. Values are always plain numeric strings.
 */
class MoneyHelper
{
    private const S = 20; // internal working scale

    public static function add(string $a, string $b, int $scale = self::S): string
    {
        return bcadd($a, $b, $scale);
    }

    public static function sub(string $a, string $b, int $scale = self::S): string
    {
        return bcsub($a, $b, $scale);
    }

    public static function mul(string $a, string $b, int $scale = self::S): string
    {
        return bcmul($a, $b, $scale);
    }

    public static function div(string $a, string $b, int $scale = self::S): string
    {
        return bcdiv($a, $b, $scale);
    }

    /** Round to 2dp with HALF_UP: add 0.005 for positive, subtract for negative, then truncate. */
    public static function round2(string $v): string
    {
        if (bccomp($v, '0', self::S) >= 0) {
            return bcadd($v, '0.005', 2);
        }
        return bcsub($v, '0.005', 2);
    }

    /** Canonical 2dp string, e.g. "1250.00". */
    public static function m(string $v): string
    {
        return number_format((float) self::round2($v), 2, '.', '');
    }

    public static function sum(array $values): string
    {
        $acc = '0';
        foreach ($values as $v) {
            $acc = bcadd($acc, (string) $v, self::S);
        }
        return $acc;
    }

    public static function min(string $a, string $b): string
    {
        return bccomp($a, $b, self::S) <= 0 ? $a : $b;
    }

    public static function max(string $a, string $b): string
    {
        return bccomp($a, $b, self::S) >= 0 ? $a : $b;
    }

    public static function gt(string $a, string $b): bool
    {
        return bccomp($a, $b, self::S) > 0;
    }

    public static function gte(string $a, string $b): bool
    {
        return bccomp($a, $b, self::S) >= 0;
    }

    public static function lt(string $a, string $b): bool
    {
        return bccomp($a, $b, self::S) < 0;
    }

    public static function lte(string $a, string $b): bool
    {
        return bccomp($a, $b, self::S) <= 0;
    }

    public static function eq(string $a, string $b): bool
    {
        return bccomp($a, $b, self::S) === 0;
    }

    public static function isPositive(string $v): bool
    {
        return bccomp($v, '0', self::S) > 0;
    }

    public static function isZero(string $v): bool
    {
        return bccomp($v, '0', self::S) === 0;
    }

    /** bcpow with internal scale (exponent must be non-negative integer). */
    public static function pow(string $base, int $exp): string
    {
        return bcpow($base, (string) $exp, self::S);
    }
}
