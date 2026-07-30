<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The Members List's every query narrows to one term first (`forTerm`), then
 * usually sorts by `created_at` (the default) or `surname` (the "Name" column),
 * and the class filter narrows on year_level + section together. None of that
 * had a matching index — `membership_term_id` was only indexed as the tail end
 * of the partial (term, lower(email)) uniqueness check, which the planner can't
 * use for a sort. At 250+ rows Postgres still picks a seq scan without being
 * asked twice, so this is here for when the roster is in the thousands, not
 * because anything measured slow today.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            // Every list request filters on the term first, regardless of sort,
            // search or trashed state — a plain index covers all of those,
            // unlike the existing partial (term, email) unique index.
            $table->index('membership_term_id');

            // (term, created_at) covers the default "no sort chosen" query —
            // narrow then order — without a separate sort step.
            $table->index(['membership_term_id', 'created_at']);

            // The "Name" column sorts on surname; also the shape a plain
            // alphabetical roster print expects.
            $table->index('surname');

            // The Year & Section filter (`inClass`) always narrows on both
            // together, never year_level alone.
            $table->index(['year_level', 'section']);
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropIndex(['membership_term_id']);
            $table->dropIndex(['membership_term_id', 'created_at']);
            $table->dropIndex(['surname']);
            $table->dropIndex(['year_level', 'section']);
        });
    }
};
