<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Membership applications submitted from the ICpEP.SE website.
     */
    public function up(): void
    {
        Schema::create('applications', function (Blueprint $table) {
            $table->id();

            // Applicant details
            $table->string('surname');
            $table->string('given_name');
            $table->string('middle_initial', 1)->nullable();
            $table->string('year_level');
            $table->string('section');
            $table->date('birthday');
            $table->text('address');
            $table->string('email');
            $table->string('phone');

            // Uploaded files (paths inside the Supabase storage bucket)
            $table->string('signature_path');
            $table->string('picture_path');

            // Review workflow
            $table->string('status')->default('pending'); // pending | approved | rejected

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('applications');
    }
};
