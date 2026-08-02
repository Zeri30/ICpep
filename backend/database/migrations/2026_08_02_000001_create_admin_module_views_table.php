<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per (officer, module) — when that officer last opened it. Backs the
 * sidebar's notification badges: DashboardController::counts reports records
 * created after this timestamp instead of the module's total, so the badge
 * means "new since you last looked," not "how many rows exist."
 *
 * Per-officer rather than a single account-wide marker: two officers with
 * access to the same module have independently unread counts, the same way
 * an inbox is unread per person, not per mailbox.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_module_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // 'members' | 'payments' | 'users' — the sidebar's badgeKey values.
            $table->string('module');
            $table->timestamp('last_viewed_at');
            $table->timestamps();

            $table->unique(['user_id', 'module']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_module_views');
    }
};
