<?php

namespace App\Jobs;

use App\Models\LoanScheduleItem;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

class SendDueRemindersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        $target = Carbon::today()->addDays(3)->toDateString();

        LoanScheduleItem::with('loan.customer')
            ->whereColumn('principal_paid', '<', 'principal_due')
            ->whereDate('due_date', $target)
            ->whereHas('loan', fn ($q) => $q->where('status', 'active'))
            ->chunk(200, function ($items) {
                foreach ($items as $item) {
                    $customer = $item->loan->customer ?? null;
                    if (!$customer) continue;

                    $alreadySent = DB::table('notifications')
                        ->where('entity_type', 'loan_schedule_item')
                        ->where('entity_id', $item->id)
                        ->where('type', 'due_reminder')
                        ->exists();

                    if ($alreadySent) continue;

                    DB::table('notifications')->insert([
                        'id'          => \Illuminate\Support\Str::uuid()->toString(),
                        'tenant_id'   => $item->loan->tenant_id,
                        'recipient'   => $customer->phone,
                        'channel'     => 'sms',
                        'type'        => 'due_reminder',
                        'body'        => "Dear {$customer->first_name}, your loan installment of MK {$item->total_due} is due on {$item->due_date->format('d M Y')}. Please arrange payment to avoid penalties.",
                        'entity_type' => 'loan_schedule_item',
                        'entity_id'   => $item->id,
                        'status'      => 'queued',
                        'created_at'  => now(),
                    ]);
                }
            });
    }
}
