<?php

namespace App\Services;

use App\Models\RememberToken;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Str;

/**
 * A selector/validator "remember me" cookie, kept in its own table rather
 * than Laravel's built-in `remember_token` column on `users`: that column
 * holds one token with no expiry, where every place that already evicts a
 * signed-in device (AdminAuthController::login's single-session rule,
 * MeController's password change / "log out other sessions", and
 * UserController::resetPassword) needs to evict a remember-me cookie the
 * same way it evicts a `sessions` row. Modeling it as its own table, the
 * same way `sessions` already is, lets those call sites just add one more
 * "delete this account's rows" query instead of inventing a second mechanism.
 *
 * The cookie carries "selector|validator": the selector is a public lookup
 * key stored in the clear, the validator's hash is what's stored — so a
 * leaked database row can't be replayed as a cookie, and a leaked cookie
 * can't be matched back to a row without also owning that row's plaintext
 * validator. Every successful use rotates both halves and deletes the old
 * row, so a copied cookie and the real one racing each other is
 * self-limiting: whichever is used first invalidates the other, and the
 * loser's next attempt lands on a selector whose validator no longer matches
 * — the standard signal that a cookie has been stolen — at which point every
 * token the account holds is revoked rather than just the one in play.
 */
class RememberMeService
{
    private const SEPARATOR = '|';

    public static function cookieName(): string
    {
        return (string) config('auth.remember_me.cookie', 'icpep_remember');
    }

    private static function durationDays(): int
    {
        return (int) config('auth.remember_me.duration_days', 30);
    }

    /** Issue a fresh token for $user and queue the cookie that carries it. */
    public static function issue(User $user, Request $request): void
    {
        $selector = Str::random(20);
        $validator = Str::random(60);

        RememberToken::create([
            'user_id' => $user->id,
            'selector' => $selector,
            'hashed_validator' => hash('sha256', $validator),
            'expires_at' => now()->addDays(self::durationDays()),
            'last_used_at' => now(),
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
        ]);

        self::queueCookie($selector, $validator);
    }

    /**
     * Resolve the account behind this request's remember cookie, if any is
     * present, unexpired, and unused since it was issued. Rotates the token
     * on success so the cookie just presented cannot be replayed.
     */
    public static function attempt(Request $request): ?User
    {
        $selector = null;
        $validator = null;
        self::parseCookie($request, $selector, $validator);

        if ($selector === null || $validator === null) {
            return null;
        }

        $token = RememberToken::where('selector', $selector)->first();

        if (! $token) {
            self::forgetCookie();

            return null;
        }

        if ($token->expires_at->isPast()) {
            $token->delete();
            self::forgetCookie();

            return null;
        }

        if (! hash_equals($token->hashed_validator, hash('sha256', $validator))) {
            // Known selector, wrong validator: this cookie's secret half does
            // not match what was issued, the signature of a copied/leaked
            // cookie. There is no way to tell the legitimate device from the
            // copy from here, so every token this account holds is revoked.
            RememberToken::where('user_id', $token->user_id)->delete();
            self::forgetCookie();

            return null;
        }

        $user = User::find($token->user_id);
        $token->delete();

        if (! $user || ! $user->canAccessAdmin()) {
            self::forgetCookie();

            return null;
        }

        self::issue($user, $request);

        return $user;
    }

    /** Every device this account is remembered on — used on password reset/change. */
    public static function forgetAllForUser(int $userId): void
    {
        RememberToken::where('user_id', $userId)->delete();
    }

    /**
     * Every remember-me token on every account, except the one this request's
     * own cookie carries (if any) — the "log out all admins" kill switch's
     * counterpart to evicting every `sessions` row but this device's.
     */
    public static function forgetAllExceptCurrent(Request $request): void
    {
        $selector = null;
        $validator = null;
        self::parseCookie($request, $selector, $validator);

        RememberToken::query()
            ->when($selector !== null, fn ($query) => $query->where('selector', '!=', $selector))
            ->delete();
    }

    /** Every device except the one whose cookie is on this request. */
    public static function forgetOthersForUser(int $userId, Request $request): void
    {
        $selector = null;
        $validator = null;
        self::parseCookie($request, $selector, $validator);

        RememberToken::where('user_id', $userId)
            ->when($selector !== null, fn ($query) => $query->where('selector', '!=', $selector))
            ->delete();
    }

    /** Revoke the token this request's cookie carries, if any, and clear the cookie. */
    public static function forgetCurrent(Request $request): void
    {
        $selector = null;
        $validator = null;
        self::parseCookie($request, $selector, $validator);

        if ($selector !== null) {
            RememberToken::where('selector', $selector)->delete();
        }

        self::forgetCookie();
    }

    public static function forgetCookie(): void
    {
        Cookie::queue(Cookie::forget(
            self::cookieName(),
            config('session.path'),
            config('session.domain'),
        ));
    }

    private static function parseCookie(Request $request, ?string &$selector, ?string &$validator): void
    {
        $cookie = $request->cookie(self::cookieName());

        if (! is_string($cookie) || ! str_contains($cookie, self::SEPARATOR)) {
            return;
        }

        [$selector, $validator] = explode(self::SEPARATOR, $cookie, 2);
    }

    private static function queueCookie(string $selector, string $validator): void
    {
        Cookie::queue(Cookie::make(
            self::cookieName(),
            $selector.self::SEPARATOR.$validator,
            self::durationDays() * 24 * 60,
            config('session.path'),
            config('session.domain'),
            (bool) config('session.secure'),
            true, // httpOnly — never readable from client-side JS
            false,
            config('session.same_site', 'lax'),
        ));
    }
}
