<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The pending/approved/rejected review flow was removed: every submitted
     * form is now a registered member. Drop the `status` column.
     *
     * The timestamp columns (`created_at`, `updated_at`, `deleted_at`) are left
     * in place — they are guaranteed here in case a fresh environment ever
     * lacks them.
     */
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            if (Schema::hasColumn('applications', 'status')) {
                $table->dropColumn('status');
            }
        });

        Schema::table('applications', function (Blueprint $table) {
            if (! Schema::hasColumn('applications', 'created_at') || ! Schema::hasColumn('applications', 'updated_at')) {
                $table->timestamps();
            }
            if (! Schema::hasColumn('applications', 'deleted_at')) {
                $table->softDeletes();
            }
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            if (! Schema::hasColumn('applications', 'status')) {
                $table->string('status')->default('pending');
            }
        });
    }
};
