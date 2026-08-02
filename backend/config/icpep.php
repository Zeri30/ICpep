<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Membership fee
    |--------------------------------------------------------------------------
    | Amount (in PHP) each member pays. Drives the "expected revenue" figure on
    | the admin dashboard. Change MEMBERSHIP_FEE in .env to update it.
    */
    'membership_fee' => (float) env('MEMBERSHIP_FEE', 50),

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
];
