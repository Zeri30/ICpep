<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\MembershipTerm;
use App\Models\RegistrationSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Opening and closing the public membership form.
 *
 * Reading the state is open to any officer (the Members module shows a banner
 * either way); changing it is terms.manage — the executive roles plus the
 * Programming Team.
 */
class RegistrationController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json($this->state());
    }

    public function close(Request $request): JsonResponse
    {
        Gate::authorize('terms.manage');

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:200'],
        ]);

        RegistrationSetting::instance()->close(trim($data['reason']));

        return response()->json($this->state());
    }

    public function open(): JsonResponse
    {
        Gate::authorize('terms.manage');

        RegistrationSetting::instance()->open();

        return response()->json($this->state());
    }

    /**
     * The switch plus the list submissions currently land in, so the admin can
     * see at a glance that reopening will file applicants under the term they
     * expect rather than the one that was active when it was closed.
     */
    private function state(): array
    {
        $setting = RegistrationSetting::instance();
        $current = MembershipTerm::current();

        return [
            'isOpen' => $setting->is_open,
            'reason' => $setting->closed_reason,
            'closedAt' => $setting->closed_at?->toIso8601String(),
            'closedBy' => $setting->closed_by,
            'presetReasons' => RegistrationSetting::PRESET_REASONS,
            'currentTerm' => $current ? [
                'id' => $current->id,
                'label' => $current->label,
            ] : null,
        ];
    }
}
