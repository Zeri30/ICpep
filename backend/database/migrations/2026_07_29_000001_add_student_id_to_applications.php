<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Student ID — a second unique identifier for a member, alongside email.
 *
 * Nullable so existing applications stay valid without a backfill; the
 * registration and edit forms require it going forward at the validation
 * layer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->string('student_id', 20)->nullable()->after('phone');

            $table->unique('student_id');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropUnique(['student_id']);
            $table->dropColumn('student_id');
        });
    }
};
