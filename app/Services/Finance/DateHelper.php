<?php

namespace App\Services\Finance;

use Carbon\Carbon;

class DateHelper
{
    public const PERIODS_PER_YEAR = [
        'daily' => 365,
        'weekly' => 52,
        'fortnightly' => 26,
        'monthly' => 12,
    ];

    public static function addDays(string $date, int $days): string
    {
        return Carbon::createFromFormat('Y-m-d', $date, 'UTC')->addDays($days)->format('Y-m-d');
    }

    /** Adds calendar months, clamping to last day of shorter months (e.g. Jan 31 + 1M = Feb 28/29). */
    public static function addMonths(string $date, int $months): string
    {
        [$y, $m, $d] = array_map('intval', explode('-', $date));
        $targetMonth = $m - 1 + $months;
        $ty = $y + intdiv($targetMonth, 12);
        $tm = (($targetMonth % 12) + 12) % 12;
        $lastDay = Carbon::createFromDate($ty, $tm + 1, 1, 'UTC')->daysInMonth;
        return sprintf('%04d-%02d-%02d', $ty, $tm + 1, min($d, $lastDay));
    }

    /** Due date of instalment k (1-based) from value/start date. */
    public static function dueDate(string $start, string $frequency, int $k): string
    {
        return match ($frequency) {
            'daily'       => self::addDays($start, $k),
            'weekly'      => self::addDays($start, 7 * $k),
            'fortnightly' => self::addDays($start, 14 * $k),
            'monthly'     => self::addMonths($start, $k),
        };
    }

    public static function daysBetween(string $from, string $to): int
    {
        $a = Carbon::createFromFormat('Y-m-d', $from, 'UTC')->startOfDay();
        $b = Carbon::createFromFormat('Y-m-d', $to, 'UTC')->startOfDay();
        return (int) $a->diffInDays($b, false);
    }

    public static function todayIn(string $timezone): string
    {
        return Carbon::now($timezone)->format('Y-m-d');
    }

    public static function periodsPerYear(string $frequency): int
    {
        return self::PERIODS_PER_YEAR[$frequency];
    }
}
