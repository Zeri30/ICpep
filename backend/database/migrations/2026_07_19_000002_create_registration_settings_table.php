<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The open/closed state of the public membership form — a single row.
 *
 * Deliberately kept separate from membership_terms: whether the form accepts
 * submissions is independent of which list those submissions land in. Closing
 * registration, rolling over to a new term and reopening are three distinct
 * acts, and the spec requires the destination to follow the current term rather
 * than whichever list was most recently touched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('registration_settings', function (Blueprint $table) {
            $table->id();

            $table->boolean('is_open')->default(true);

            // Shown verbatim to applicants while the form is closed.
            $table->string('closed_reason')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->string('closed_by')->nullable();   // actor email, for the audit trail
            $table->timestamp('opened_at')->nullable();
            $table->string('opened_by')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('registration_settings');
    }
};
