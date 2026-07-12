<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A running history of actions performed in the admin (and new signups).
     */
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->string('actor')->nullable();   // admin email, or null for the public website
            $table->string('action');               // registered | approved | rejected | deleted | restored | force_deleted | login
            $table->string('description');          // human-readable summary
            $table->string('applicant')->nullable();// applicant name, when relevant
            $table->timestamps();

            $table->index('action');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
