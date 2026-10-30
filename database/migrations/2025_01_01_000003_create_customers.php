<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('loan_groups', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('branch_id')->constrained('branches');
            $table->string('name');
            $table->string('meeting_place')->nullable();
            $table->string('meeting_day')->nullable();
            $table->foreignUuid('officer_id')->nullable()->constrained('users');
            $table->boolean('is_active')->default(true);
            $table->uuid('created_by');
            $table->timestampTz('created_at')->useCurrent();
            $table->index(['tenant_id', 'branch_id'], 'loan_groups_branch_idx');
        });

        DB::statement("CREATE UNIQUE INDEX loan_groups_tenant_name_uq ON loan_groups (tenant_id, lower(name))");

        Schema::create('customers', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('branch_id')->constrained('branches');
            $table->string('customer_number', 20);
            $table->string('first_name');
            $table->string('last_name');
            $table->string('nrc', 11);
            $table->string('phone', 16);
            $table->string('email')->nullable();
            $table->date('date_of_birth');
            $table->string('gender');
            $table->text('address');
            $table->string('employer')->nullable();
            $table->string('occupation')->nullable();
            $table->decimal('monthly_income', 18, 2);
            $table->string('next_of_kin_name')->nullable();
            $table->string('next_of_kin_phone')->nullable();
            $table->foreignUuid('group_id')->nullable()->constrained('loan_groups');
            $table->enum('kyc_status', ['pending', 'verified', 'rejected'])->default('pending');
            $table->text('kyc_note')->nullable();
            $table->uuid('kyc_decided_by')->nullable();
            $table->timestampTz('consent_at');
            $table->uuid('created_by');
            $table->timestampTz('created_at')->useCurrent();
            $table->unique(['tenant_id', 'nrc'], 'customers_tenant_nrc_uq');
            $table->unique(['tenant_id', 'customer_number'], 'customers_tenant_number_uq');
            $table->index(['tenant_id', 'phone'], 'customers_tenant_phone_idx');
            $table->index(['tenant_id', 'branch_id'], 'customers_branch_idx');
        });

        Schema::create('customer_documents', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('customer_id')->constrained('customers');
            $table->string('doc_type');
            $table->string('file_name');
            $table->string('mime_type');
            $table->integer('size_bytes');
            $table->string('storage_key');
            $table->string('sha256');
            $table->uuid('uploaded_by');
            $table->timestampTz('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_documents');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('loan_groups');
    }
};
