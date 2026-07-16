<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Application;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The signed-in officer plus the small pieces of config the admin UI needs to
 * label money and build its filters (fee, currency, class/section/year options).
 * Fetched once when the admin shell mounts.
 */
class MeController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => [
                'name' => $user->name,
                'email' => $user->email,
            ],
            'meta' => [
                'fee' => (float) config('icpep.membership_fee'),
                'currency' => config('icpep.currency_symbol'),
                'classOptions' => array_keys(Application::CLASS_MAP),
                'sections' => Application::SECTIONS,
                'yearLevels' => Application::YEAR_LEVELS,
            ],
        ]);
    }
}
