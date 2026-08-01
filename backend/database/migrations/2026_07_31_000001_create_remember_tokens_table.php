<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A selector/validator pair, not Laravel's own `remember_token` column
        // on `users`: that column can only hold one token at a time and has no
        // expiry, where every place that already kills sessions
        // (AdminAuthController::login, MeController, UserController::resetPassword)
        // needs to evict remember-me cookies the same way it evicts `sessions`
        // rows. `selector` is the public lookup key; `hashed_validator` is the
        // secret half's hash, so a leaked database row alone can't be replayed
        // as a cookie.
        Schema::create('remember_tokens', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('selector', 40)->unique();
            $table->string('hashed_validator', 64);
            $table->timestamp('expires_at');
            $table->timestamp('last_used_at')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('remember_tokens');
    }
};
