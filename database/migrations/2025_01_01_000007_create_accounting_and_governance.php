<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('chart_of_accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->string('code', 10);
            $table->string('name');
            $table->enum('type', ['asset', 'liability', 'equity', 'income', 'expense']);
            $table->unique(['tenant_id', 'code'], 'coa_tenant_code_uq');
        });

        Schema::create('journal_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->string('entry_number', 20);
            $table->date('entry_date');
            $table->text('description');
            $table->string('source_type');
            $table->uuid('source_id')->nullable();
            $table->uuid('reversal_of_id')->nullable();
            $table->uuid('posted_by')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['tenant_id', 'entry_number'], 'journal_tenant_number_uq');
            $table->index(['tenant_id', 'entry_date'], 'journal_date_idx');
        });

        Schema::create('journal_lines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->foreignUuid('entry_id')->constrained('journal_entries');
            $table->foreignUuid('account_id')->constrained('chart_of_accounts');
            $table->decimal('debit', 18, 2)->default(0);
            $table->decimal('credit', 18, 2)->default(0);
            $table->index('entry_id', 'journal_lines_entry_idx');
            $table->index(['tenant_id', 'account_id'], 'journal_lines_account_idx');
        });

        DB::statement('ALTER TABLE journal_lines ADD CONSTRAINT journal_line_one_side CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0) AND (debit + credit) > 0)');

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->string('channel');
            $table->string('recipient');
            $table->string('template');
            $table->text('message');
            $table->string('status')->default('queued');
            $table->string('dedupe_key')->nullable();
            $table->string('related_type')->nullable();
            $table->uuid('related_id')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('sent_at')->nullable();
            $table->unique(['tenant_id', 'dedupe_key'], 'notifications_dedupe_uq');
        });

        Schema::create('webhook_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable();
            $table->string('provider');
            $table->string('external_ref')->nullable();
            $table->json('payload');
            $table->boolean('signature_valid');
            $table->string('outcome');
            $table->text('error')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->bigIncrements('seq');
            $table->uuid('tenant_id')->nullable();
            $table->uuid('user_id')->nullable();
            $table->string('action');
            $table->string('entity_type');
            $table->string('entity_id')->nullable();
            $table->json('data');
            $table->string('ip')->nullable();
            $table->text('prev_hash');
            $table->text('hash');
            $table->timestamp('created_at');
            $table->index(['tenant_id', 'seq'], 'audit_tenant_seq_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('webhook_events');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('journal_lines');
        Schema::dropIfExists('journal_entries');
        Schema::dropIfExists('chart_of_accounts');
    }
};
