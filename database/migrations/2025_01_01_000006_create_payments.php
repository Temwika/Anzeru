<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('loan_id')->constrained('loans');
            $table->string('receipt_number', 20);
            $table->decimal('amount', 18, 2);
            $table->decimal('unallocated', 18, 2)->default(0);
            $table->enum('channel', ['cash', 'bank', 'mtn_momo', 'airtel_money']);
            $table->string('external_ref')->nullable();
            $table->string('idempotency_key');
            $table->enum('status', ['posted', 'reversed'])->default('posted');
            $table->date('received_on');
            $table->uuid('recorded_by')->nullable();
            $table->uuid('journal_entry_id')->nullable();
            $table->json('interest_waivers')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['tenant_id', 'idempotency_key'], 'payments_tenant_idem_uq');
            $table->unique(['tenant_id', 'receipt_number'], 'payments_tenant_receipt_uq');
            $table->index('loan_id', 'payments_loan_idx');
        });

        DB::statement('ALTER TABLE payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0)');

        Schema::create('collection_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('loan_id')->constrained('loans');
            $table->uuid('requested_by');
            $table->enum('channel', ['cash', 'bank', 'mtn_momo', 'airtel_money']);
            $table->string('msisdn', 15);
            $table->decimal('amount', 18, 2);
            $table->boolean('settlement')->default(false);
            $table->enum('status', ['pending', 'succeeded', 'failed'])->default('pending');
            $table->string('provider_ref')->nullable();
            $table->uuid('payment_id')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('completed_at')->nullable();
            $table->index(['tenant_id', 'loan_id'], 'collection_requests_loan_idx');
        });

        DB::statement('ALTER TABLE collection_requests ADD CONSTRAINT collection_requests_amount_positive CHECK (amount > 0)');

        Schema::create('payment_allocations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('payment_id')->constrained('payments');
            $table->foreignUuid('schedule_item_id')->constrained('loan_schedule_items');
            $table->enum('component', ['penalty', 'fee', 'interest', 'principal']);
            $table->decimal('amount', 18, 2);
            $table->index('payment_id', 'allocations_payment_idx');
        });

        Schema::create('payment_reversals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('payment_id')->constrained('payments');
            $table->text('reason');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->uuid('requested_by');
            $table->timestamp('requested_at')->useCurrent();
            $table->uuid('decided_by')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->text('note')->nullable();
            $table->uuid('journal_entry_id')->nullable();
        });

        Schema::create('collection_activities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('loan_id')->constrained('loans');
            $table->enum('type', ['call', 'sms', 'visit', 'promise_to_pay', 'note']);
            $table->text('note');
            $table->decimal('promised_amount', 18, 2)->nullable();
            $table->date('promised_date')->nullable();
            $table->uuid('created_by');
            $table->timestamp('created_at')->useCurrent();
            $table->index('loan_id', 'collection_activities_loan_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('collection_activities');
        Schema::dropIfExists('payment_reversals');
        Schema::dropIfExists('payment_allocations');
        Schema::dropIfExists('collection_requests');
        Schema::dropIfExists('payments');
    }
};
