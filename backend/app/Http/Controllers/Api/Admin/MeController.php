<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\RoleFamily;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Application;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

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
                // True for an account still on its system-generated
                // first-login password — the frontend routes it to
                // /change-password instead of the admin before anything
                // else, and EnsureAdmin refuses every other endpoint until it
                // is cleared.
                'mustChangePassword' => (bool) $user->must_change_password,
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

    /**
     * Set your own password — the only self-service write this controller
     * does. The one route EnsureAdmin still allows an account through on its
     * first-login default, since it is the way out of that state.
     *
     * Refuses a "new" password that is the one already on the account: on a
     * first login that is almost always the officer re-typing the default
     * they were just given rather than one they chose, which is exactly the
     * gap a forced change exists to close.
     */
    public function updatePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'password' => [
                'required',
                'string',
                'confirmed',
                Password::min(8)->mixedCase()->numbers()->symbols(),
            ],
        ]);

        $user = $request->user();

        if (Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'password' => 'Choose a password you have not used before.',
            ]);
        }

        $user->update([
            'password' => Hash::make($data['password']),
            'must_change_password' => false,
        ]);

        ActivityLog::record('password_changed', "{$user->name} changed their password", $user->name);

        return response()->json(['ok' => true]);
    }
}
