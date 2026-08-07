<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Membership fee
    |--------------------------------------------------------------------------
    | Collected in two sequential batches rather than one flat amount — ₱50
    | (Payment 1) then ₱25 (Payment 2), ₱75 combined. Drives the "expected
    | revenue" figure on the admin dashboard and the ledger amount recorded
    | for each batch. Change MEMBERSHIP_FEE_1 / MEMBERSHIP_FEE_2 in .env to
    | update them.
    */
    'membership_fee_1' => (float) env('MEMBERSHIP_FEE_1', 50),
    'membership_fee_2' => (float) env('MEMBERSHIP_FEE_2', 25),

    'currency_symbol' => env('MEMBERSHIP_CURRENCY', '₱'),

    /*
    |--------------------------------------------------------------------------
    | Organization timezone
    |--------------------------------------------------------------------------
    | Where the chapter actually operates. Timestamps are stored in UTC (see
    | config/app.php), so this is the timezone a wall-clock date and time typed
    | by an officer is interpreted in, and converted back to for display —
    | today, the scheduled events on the calendar. Decide it once here rather
    | than assuming the viewer's device is set to it.
    */
    'timezone' => env('ORG_TIMEZONE', 'Asia/Manila'),

    /*
    |--------------------------------------------------------------------------
    | Frontend URL
    |--------------------------------------------------------------------------
    | Where the Next.js admin is served. Read through config rather than env()
    | directly so it survives config caching. Used to build the absolute URL an
    | event's attendance QR code encodes — a phone camera has no page to resolve
    | a relative path against. Same value CORS allows (see config/cors.php).
    */
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),

    /*
    |--------------------------------------------------------------------------
    | Admin idle timeout
    |--------------------------------------------------------------------------
    | Minutes of no genuine officer activity before a signed-in admin session
    | is forced out — see App\Http\Middleware\EnforceIdleTimeout. Distinct
    | from SESSION_LIFETIME (config/session.php): that resets on any request,
    | including the admin UI's own background polling, so it does not reflect
    | whether anyone is actually there.
    */
    'idle_timeout_minutes' => (int) env('ADMIN_IDLE_TIMEOUT_MINUTES', 360),

    /*
    |--------------------------------------------------------------------------
    | Activity Log retention
    |--------------------------------------------------------------------------
    | Days a row is kept before the scheduled prune (see
    | App\Console\Commands\PruneActivityLogs, run daily in routes/console.php)
    | deletes it. The Activity Log is an audit trail rather than session-like
    | data, so this defaults far longer than REMEMBER_ME_DURATION_DAYS — two
    | years, long enough to span several membership terms — not because
    | anything has measured a problem yet, but because the table is written to
    | on nearly every admin action across every module and would otherwise
    | grow forever.
    */
    'activity_log_retention_days' => (int) env('ACTIVITY_LOG_RETENTION_DAYS', 730),
];
