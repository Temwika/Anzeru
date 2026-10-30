<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('tenant_id')->nullable()->constrained('tenants');
            $table->string('email')->unique();
            $table->string('password_hash');
            $table->string('full_name');
            $table->enum('role', [
                'platform_admin', 'institution_admin', 'credit_officer',
                'credit_manager', 'cashier', 'accountant', 'auditor', 'borrower',
            ]);
            $table->decimal('approval_limit', 18, 2)->default(0);
            $table->uuid('customer_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('failed_logins')->default(0);
            $table->timestampTz('locked_until')->nullable();
            $table->text('mfa_secret')->nullable();
            $table->boolean('mfa_enabled')->default(false);
            $table->timestampTz('last_login_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->index('tenant_id', 'users_tenant_idx');
            $table->rememberToken();
        });

        Schema::create('user_branch_access', function (Blueprint $table) {
            $table->foreignUuid('user_id')->constrained('users');
            $table->foreignUuid('branch_id')->constrained('branches');
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->primary(['user_id', 'branch_id']);
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('user_branch_access');
        Schema::dropIfExists('users');
    }
};
