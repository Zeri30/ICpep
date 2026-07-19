<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Attach every membership record to a term, and seed the first one.
 *
 * Records predate the concept of a term, so they are backfilled into
 * 2026–2027 Semester 1 — the school year current at the time this shipped —
 * which also becomes the active list so registration keeps flowing without an
 * admin having to create anything first.
 *
 * payment_transactions carries its own copy rather than reading through the
 * application: the ledger already denormalises member name and section so a
 * row survives a force-delete of the member, and the term has to survive it
 * too or a historical semester's revenue would silently change.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->foreignId('membership_term_id')->nullable()->after('id')
                ->constrained('membership_terms')->nullOnDelete();
        });

        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->foreignId('membership_term_id')->nullable()->after('id')
                ->constrained('membership_terms')->nullOnDelete();
        });

        $now = now();

        $termId = DB::table('membership_terms')->insertGetId([
            'school_year_from' => 2026,
            'school_year_to' => 2027,
            'semester' => 1,
            'is_current' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('applications')->update(['membership_term_id' => $termId]);
        DB::table('payment_transactions')->update(['membership_term_id' => $termId]);

        // The form starts open — its previous behaviour, which had no switch.
        DB::table('registration_settings')->insert([
            'is_open' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('membership_term_id');
        });

        Schema::table('applications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('membership_term_id');
        });
    }
};
