<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\RoleFamily;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Event;
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
                'username' => $user->username,
                'email' => $user->email,
                'role' => $user->role?->value,
                'roleLabel' => $user->role?->label(),
                'canManageUsers' => $user->canManageUsers(),
                // The ability strings the UI gates modules and actions on — the
                // same values the backend Gates enforce.
                'permissions' => array_map(
                    fn ($p): string => $p->value,
                    $user->role?->permissions() ?? [],
                ),
            ],
            'meta' => [
                'fee' => (float) config('icpep.membership_fee'),
                'currency' => config('icpep.currency_symbol'),
                'classOptions' => array_keys(Application::CLASS_MAP),
                'sections' => Application::SECTIONS,
                'yearLevels' => Application::YEAR_LEVELS,
                // Every role, each carrying the family it belongs to — the admin
                // groups the role selects and colours its role badges by that,
                // so the classification is stated once here rather than kept in
                // step in the UI.
                'roles' => UserRole::options(),
                // The family headings, in the order they should be shown — see
                // RoleFamily::options() for why the order is sent rather than
                // inferred from the roles above.
                'roleFamilies' => RoleFamily::options(),
                // Which role the account form starts on. Sent rather than the
                // form picking the last option, which only happened to be the
                // least-privileged role until the Team Heads were added after it.
                'defaultRole' => UserRole::default()->value,
                // The event form's Category select. Sent with the rest of the
                // config so the calendar never has to make a second call just
                // to populate a dropdown.
                'eventCategories' => Event::CATEGORIES,
                // Every date on the calendar means a day in this timezone, not
                // in the viewer's — shown in the UI so that is never a guess.
                'timezone' => Event::timezone(),
            ],
        ]);
    }
}
