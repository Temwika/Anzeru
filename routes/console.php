<?php

use App\Jobs\ApplyPenaltiesJob;
use App\Jobs\SendDueRemindersJob;
use App\Jobs\SendOverdueNoticesJob;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// cPanel cron: * * * * * cd /home/.../public_html && php artisan schedule:run >> /dev/null 2>&1
Schedule::job(ApplyPenaltiesJob::class)->hourly()->withoutOverlapping();
Schedule::job(SendDueRemindersJob::class)->hourly()->withoutOverlapping();
Schedule::job(SendOverdueNoticesJob::class)->hourly()->withoutOverlapping();
