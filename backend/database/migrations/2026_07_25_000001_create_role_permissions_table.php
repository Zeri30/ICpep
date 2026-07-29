<?php

use App\Enums\UserRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-role overrides of the permission matrix, so the Programming Team can grant
 * or revoke a role's abilities from User Management instead of the matrix being
 * fixed in code.
 *
 * One row per customized role, holding that role's complete ability list. A role
 * with no row here has never been customized and falls back to
 * {@see UserRole::defaultPermissions()} — which keeps the shipped
 * defaults meaningful and makes "revoke everything" (an empty array in an
 * existing row) distinguishable from "untouched".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('role_permissions', function (Blueprint $table) {
            $table->id();

            // The UserRole value, e.g. "president". Unique: one row per role.
            $table->string('role')->unique();

            // The complete list of Permission values granted to the role.
            $table->json('permissions');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_permissions');
    }
};
