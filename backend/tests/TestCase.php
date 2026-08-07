<?php

namespace Tests;

use App\Models\RolePermission;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Cache;

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

        // The array cache driver used in tests lives for the whole process,
        // not just one request, so it outlives RefreshDatabase's rollback the
        // same way. That includes Payment History's list cache (see
        // PaymentTransaction and PaymentController::index, one generation
        // counter per term) and MembershipTerm's id/current lookups — rather
        // than bump every counter a test might touch, clear the whole store
        // so every test starts cold.
        Cache::flush();
    }
}
