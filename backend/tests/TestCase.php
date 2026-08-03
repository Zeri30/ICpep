<?php

namespace Tests;

use App\Models\PaymentTransaction;
use App\Models\RolePermission;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // The permission matrix is memoized for the life of the process, which
        // is one request in the app but the whole suite here — so without this
        // a role customized by one test would still look customized to the
        // next, long after the database was rolled back.
        RolePermission::flush();

        // Same cross-request-cache-outliving-the-database problem as above,
        // for Payment History's list cache (see PaymentTransaction and
        // PaymentController::index): bumping the version here guarantees every
        // test starts on a generation no prior test's cached page could match,
        // rather than relying on a coincidental id/filter collision never
        // happening between two tests that never write a payment themselves.
        PaymentTransaction::bumpCacheVersion();
    }
}
