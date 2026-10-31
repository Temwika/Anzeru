<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('loan_products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->string('name');
            $table->string('code', 16);
            $table->text('description')->nullable();
            $table->enum('interest_method', ['reducing_balance', 'flat', 'flat_term', 'interest_only']);
            $table->decimal('annual_rate_pct', 9, 4);
            $table->enum('repayment_frequency', ['daily', 'weekly', 'fortnightly', 'monthly']);
            $table->decimal('min_amount', 18, 2);
            $table->decimal('max_amount', 18, 2);
            $table->integer('min_term');
            $table->integer('max_term');
            $table->decimal('processing_fee_pct', 9, 4)->default(0);
            $table->decimal('penalty_pct', 9, 4)->default(0);
            $table->integer('grace_days')->default(0);
            $table->decimal('max_dti_pct', 9, 4)->default(40);
            $table->boolean('requires_guarantor')->default(false);
            $table->boolean('requires_collateral')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['tenant_id', 'code'], 'loan_products_tenant_code_uq');
        });

        Schema::create('loan_applications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('branch_id')->constrained('branches');
            $table->string('application_number', 20);
            $table->foreignUuid('customer_id')->constrained('customers');
            $table->foreignUuid('product_id')->constrained('loan_products');
            $table->decimal('amount', 18, 2);
            $table->integer('term');
            $table->text('purpose');
            $table->decimal('monthly_income', 18, 2);
            $table->decimal('monthly_expenses', 18, 2);
            $table->decimal('existing_debt_repayments', 18, 2);
            $table->enum('status', ['submitted', 'approved', 'rejected', 'cancelled'])->default('submitted');
            $table->enum('channel', ['branch', 'self_service'])->default('branch');
            $table->json('assessment');
            $table->uuid('submitted_by');
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamp('decided_at')->nullable();
            $table->text('borrower_signature')->nullable();
            $table->timestamp('borrower_signed_at')->nullable();
            $table->unique(['tenant_id', 'application_number'], 'applications_tenant_number_uq');
            $table->index(['tenant_id', 'status'], 'applications_status_idx');
        });

        Schema::create('guarantors', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('application_id')->constrained('loan_applications');
            $table->string('full_name');
            $table->string('nrc', 11);
            $table->string('phone', 16);
            $table->string('relationship');
            $table->text('address')->nullable();
            $table->text('signature')->nullable();
            $table->timestamp('signed_at')->nullable();
        });

        Schema::create('collateral', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('application_id')->constrained('loan_applications');
            $table->string('type');
            $table->text('description');
            $table->string('identifier')->nullable();
            $table->decimal('estimated_value', 18, 2);
            $table->string('location')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('application_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('application_id')->constrained('loan_applications');
            $table->foreignUuid('guarantor_id')->nullable()->constrained('guarantors');
            $table->foreignUuid('collateral_id')->nullable()->constrained('collateral');
            $table->string('doc_type');
            $table->string('file_name');
            $table->string('mime_type');
            $table->integer('size_bytes');
            $table->string('storage_key');
            $table->string('sha256');
            $table->uuid('uploaded_by');
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('credit_decisions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('application_id')->constrained('loan_applications');
            $table->string('decision');
            $table->text('reason');
            $table->decimal('approver_limit', 18, 2);
            $table->uuid('decided_by');
            $table->timestamp('decided_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credit_decisions');
        Schema::dropIfExists('application_documents');
        Schema::dropIfExists('collateral');
        Schema::dropIfExists('guarantors');
        Schema::dropIfExists('loan_applications');
        Schema::dropIfExists('loan_products');
    }
};
