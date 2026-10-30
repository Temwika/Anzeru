<x-filament-panels::page>
    <div class="mb-4 flex gap-2">
        <x-filament::button
            wire:click="$set('queue', 'disbursements')"
            :color="$queue === 'disbursements' ? 'primary' : 'gray'"
        >
            Disbursements
            @php $count = \App\Models\LoanDisbursement::where('status', 'requested')->count(); @endphp
            @if ($count) <span class="ml-1 rounded-full bg-warning-500 px-1.5 text-xs text-white">{{ $count }}</span> @endif
        </x-filament::button>
        <x-filament::button
            wire:click="$set('queue', 'reversals')"
            :color="$queue === 'reversals' ? 'primary' : 'gray'"
        >
            Reversals
            @php $rCount = \App\Models\PaymentReversal::where('status', 'requested')->count(); @endphp
            @if ($rCount) <span class="ml-1 rounded-full bg-warning-500 px-1.5 text-xs text-white">{{ $rCount }}</span> @endif
        </x-filament::button>
    </div>

    {{ $this->table }}
</x-filament-panels::page>
