<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Moves the two-tier role scheme (super_admin / admin) onto the organization's
 * full role set. The bootstrap Super Admin becomes the Programming Team (the
 * only legacy role that could manage accounts); any other legacy value falls
 * back to the least-privilege, view-only Board of Directors role.
 *
 * Must run before the app reads any User through the UserRole enum cast, since
 * the old values are no longer valid cases.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->where('role', 'super_admin')->update(['role' => 'programming_team']);
        DB::table('users')->where('role', 'admin')->update(['role' => 'programming_team']);

        // Anything unexpected (future-proofing) lands on the safest role.
        $known = [
            'programming_team', 'president', 'adviser', 'vpea', 'vpia',
            'secretary', 'assistant_secretary', 'treasurer', 'assistant_treasurer', 'pro', 'bod',
        ];
        DB::table('users')->whereNotIn('role', $known)->update(['role' => 'bod']);

        // New accounts must be assigned a role explicitly; default to view-only.
        Schema::table('users', function (Blueprint $table): void {
            $table->string('role')->default('bod')->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('role')->default('admin')->change();
        });

        DB::table('users')->where('role', 'programming_team')->update(['role' => 'super_admin']);
    }
};
