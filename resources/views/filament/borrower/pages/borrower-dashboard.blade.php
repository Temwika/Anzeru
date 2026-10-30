<x-filament-panels::page>
    @if (!$customer)
        <x-filament::section>
            <p class="text-gray-500">Your account is not yet linked to a borrower profile. Please contact your branch.</p>
        </x-filament::section>
    @else
        {{-- Next payment alert --}}
        @if ($nextInstallment)
        <x-filament::section>
            <div class="flex items-center gap-4">
                <div class="flex-1">
                    <p class="text-sm text-gray-500">Next payment due</p>
                    <p class="text-2xl font-bold">MK {{ $nextInstallment['total_due'] }}</p>
                    <p class="text-sm text-gray-500">Due on {{ $nextInstallment['due_date'] }}</p>
                </div>
                <x-filament::button
                    href="{{ \App\Filament\Borrower\Pages\BorrowerApplyPage::getUrl() }}"
                    tag="a"
                    color="primary"
                >
                    Apply for a Loan
                </x-filament::button>
            </div>
        </x-filament::section>
        @else
        <x-filament::section>
            <div class="flex items-center justify-between">
                <p class="text-gray-500">You have no upcoming payments.</p>
                <x-filament::button
                    href="{{ \App\Filament\Borrower\Pages\BorrowerApplyPage::getUrl() }}"
                    tag="a"
                    color="primary"
                >
                    Apply for a Loan
                </x-filament::button>
            </div>
        </x-filament::section>
        @endif

        {{-- Active loans --}}
        @if (count($activeLoans))
        <x-filament::section heading="My Loans">
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-gray-200 text-left text-xs text-gray-500">
                            <th class="pb-2 pr-4">Loan #</th>
                            <th class="pb-2 pr-4">Product</th>
                            <th class="pb-2 pr-4 text-right">Principal</th>
                            <th class="pb-2 pr-4 text-right">Outstanding</th>
                            <th class="pb-2">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($activeLoans as $loan)
                        <tr class="border-b border-gray-100">
                            <td class="py-2 pr-4 font-mono">{{ $loan['loan_number'] }}</td>
                            <td class="py-2 pr-4">{{ $loan['product'] }}</td>
                            <td class="py-2 pr-4 text-right">{{ $loan['principal'] }}</td>
                            <td class="py-2 pr-4 text-right font-semibold">{{ $loan['outstanding'] }}</td>
                            <td class="py-2">
                                <span class="rounded-full px-2 py-0.5 text-xs
                                    {{ $loan['status'] === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700' }}">
                                    {{ ucfirst(str_replace('_', ' ', $loan['status'])) }}
                                </span>
                            </td>
                        </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        </x-filament::section>
        @endif
    @endif
</x-filament-panels::page>
