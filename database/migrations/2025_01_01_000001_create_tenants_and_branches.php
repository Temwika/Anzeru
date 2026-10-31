<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('code', 12)->unique();
            $table->char('currency', 3)->default('ZMW');
            $table->string('timezone')->default('Africa/Lusaka');
            $table->string('plan')->default('starter');
            $table->string('status')->default('active');
            $table->json('profile')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('branches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->string('name');
            $table->string('code', 8);
            $table->text('address')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['tenant_id', 'code'], 'branches_tenant_code_uq');
        });

        Schema::create('counters', function (Blueprint $table) {
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->string('key');
            $table->integer('value');
            $table->primary(['tenant_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('counters');
        Schema::dropIfExists('branches');
        Schema::dropIfExists('tenants');
    }
};
