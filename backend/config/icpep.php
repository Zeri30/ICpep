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
];
