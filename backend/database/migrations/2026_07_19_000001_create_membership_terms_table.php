<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Membership terms — one independent membership list per semester of a school
 * year (e.g. 2026–2027 Semester 1). Exactly one row is the current list; it is
 * the destination for every new application. All others are historical records.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('membership_terms', function (Blueprint $table) {
            $table->id();

            // A school year spans two calendar years: 2026–2027.
            $table->unsignedSmallInteger('school_year_from');
            $table->unsignedSmallInteger('school_year_to');
            $table->unsignedTinyInteger('semester'); // 1 | 2

            // The single list accepting new registrations. Enforced to one row
            // by the application layer (MembershipTerm::makeCurrent).
            $table->boolean('is_current')->default(false);

            $table->timestamps();

            // A given semester of a given school year exists at most once.
            $table->unique(['school_year_from', 'semester']);
            $table->index('is_current');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('membership_terms');
    }
};
