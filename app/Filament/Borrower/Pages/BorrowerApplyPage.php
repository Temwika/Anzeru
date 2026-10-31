<?php

namespace App\Filament\Borrower\Pages;

use App\Models\LoanProduct;
use App\Services\Finance\ScheduleService;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Wizard;
use Filament\Forms\Components\Wizard\Step;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Str;
use App\Models\LoanApplication;
use App\Services\NumberingService;

class BorrowerApplyPage extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-plus-circle';
    protected static ?string $navigationLabel = 'Apply for a Loan';
    protected static string $view = 'filament.borrower.pages.borrower-apply';
    protected static string $routePath = '/apply';
    protected static ?string $title = 'Apply for a Loan';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill();
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Wizard::make([
                    Step::make('Product')
                        ->schema([
                            Select::make('product_id')
                                ->label('Loan Product')
                                ->options(LoanProduct::where('is_active', true)->pluck('name', 'id'))
                                ->required()
                                ->reactive(),
                        ]),
                    Step::make('Amount & Term')
                        ->schema([
                            TextInput::make('amount')
                                ->label('Loan Amount (K)')
                                ->numeric()
                                ->minValue(1)
                                ->required(),
                            TextInput::make('term')
                                ->label('Term (number of installments)')
                                ->numeric()
                                ->minValue(1)
                                ->required(),
                        ]),
                    Step::make('Details & Consent')
                        ->schema([
                            Textarea::make('purpose')
                                ->label('Purpose of Loan')
                                ->required()
                                ->rows(2),
                            TextInput::make('monthly_income')
                                ->label('Monthly Income (K)')
                                ->numeric()
                                ->required(),
                            TextInput::make('monthly_expenses')
                                ->label('Monthly Expenses (K)')
                                ->numeric()
                                ->required(),
                            TextInput::make('existing_debt_repayments')
                                ->label('Existing Debt Repayments (K)')
                                ->numeric()
                                ->default(0),
                        ]),
                ])->submitAction(
                    \Filament\Forms\Components\Actions\Action::make('submit')
                        ->label('Submit Application')
                        ->action('submit')
                ),
            ])
            ->statePath('data');
    }

    public function submit(): void
    {
        $data = $this->form->getState();
        $user = auth()->user();

        if (!$user->customer_id) {
            Notification::make()->title('No borrower profile found')->danger()->send();
            return;
        }

        $tenantId = $user->tenant_id;
        $appNumber = NumberingService::next('application', $tenantId);

        LoanApplication::create([
            'id'                 => Str::uuid()->toString(),
            'tenant_id'          => $tenantId,
            'branch_id'          => $user->branches()->first()?->id,
            'application_number' => $appNumber,
            'customer_id'        => $user->customer_id,
            'product_id'         => $data['product_id'],
            'amount'                    => $data['amount'],
            'term'                      => $data['term'],
            'purpose'                   => $data['purpose'],
            'monthly_income'            => $data['monthly_income'],
            'monthly_expenses'          => $data['monthly_expenses'],
            'existing_debt_repayments'  => $data['existing_debt_repayments'] ?? 0,
            'status'                    => 'submitted',
            'submitted_by'       => $user->id,
            'submitted_at'       => now(),
            'assessment'         => [],
        ]);

        Notification::make()
            ->title("Application $appNumber submitted")
            ->body('Your loan application has been submitted. You will be notified once reviewed.')
            ->success()
            ->send();

        $this->redirect(BorrowerDashboard::getUrl());
    }
}
