<?php

namespace Tests;

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
    }
}
