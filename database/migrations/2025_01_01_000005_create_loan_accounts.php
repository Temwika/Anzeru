<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('loans', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('branch_id')->constrained('branches');
            $table->string('loan_number', 20);
            $table->foreignUuid('application_id')->unique()->constrained('loan_applications');
            $table->foreignUuid('customer_id')->constrained('customers');
            $table->foreignUuid('product_id')->constrained('loan_products');
            $table->uuid('officer_id');
            $table->uuid('approved_by');
            $table->decimal('principal', 18, 2);
            $table->decimal('annual_rate_pct', 9, 4);
            $table->enum('interest_method', ['reducing_balance', 'flat', 'flat_term', 'interest_only']);
            $table->enum('frequency', ['daily', 'weekly', 'fortnightly', 'monthly']);
            $table->integer('term');
            $table->decimal('processing_fee', 18, 2);
            $table->decimal('penalty_pct', 9, 4);
            $table->integer('grace_days');
            $table->enum('status', ['pending_disbursement', 'active', 'closed', 'written_off'])->default('pending_disbursement');
            $table->date('disbursed_on')->nullable();
            $table->date('maturity_date')->nullable();
            $table->timestampTz('closed_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->unique(['tenant_id', 'loan_number'], 'loans_tenant_number_uq');
            $table->index(['tenant_id', 'status'], 'loans_status_idx');
            $table->index(['tenant_id', 'customer_id'], 'loans_customer_idx');
        });

        Schema::create('loan_schedule_items', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('loan_id')->constrained('loans');
            $table->integer('installment_no');
            $table->date('due_date');
            $table->decimal('principal_due', 18, 2);
            $table->decimal('interest_due', 18, 2);
            $table->decimal('fee_due', 18, 2)->default(0);
            $table->decimal('penalty_due', 18, 2)->default(0);
            $table->decimal('principal_paid', 18, 2)->default(0);
            $table->decimal('interest_paid', 18, 2)->default(0);
            $table->decimal('fee_paid', 18, 2)->default(0);
            $table->decimal('penalty_paid', 18, 2)->default(0);
            $table->timestampTz('penalty_applied_at')->nullable();
            $table->unique(['loan_id', 'installment_no'], 'schedule_loan_installment_uq');
            $table->index(['tenant_id', 'due_date'], 'schedule_due_idx');
        });

        DB::statement('ALTER TABLE loan_schedule_items ADD CONSTRAINT schedule_paid_not_negative CHECK (principal_paid >= 0 AND interest_paid >= 0 AND fee_paid >= 0 AND penalty_paid >= 0)');

        Schema::create('loan_disbursements', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('loan_id')->constrained('loans');
            $table->decimal('amount', 18, 2);
            $table->decimal('fee', 18, 2);
            $table->decimal('net_amount', 18, 2);
            $table->enum('channel', ['cash', 'bank', 'mtn_momo', 'airtel_money']);
            $table->text('destination');
            $table->date('value_date');
            $table->enum('status', ['requested', 'completed', 'rejected'])->default('requested');
            $table->string('provider_ref')->nullable();
            $table->text('note')->nullable();
            $table->uuid('requested_by');
            $table->timestampTz('requested_at')->useCurrent();
            $table->uuid('decided_by')->nullable();
            $table->timestampTz('decided_at')->nullable();
            $table->uuid('journal_entry_id')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loan_disbursements');
        Schema::dropIfExists('loan_schedule_items');
        Schema::dropIfExists('loans');
    }
};
