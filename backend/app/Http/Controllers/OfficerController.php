<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * Public: the executive board shown on the landing page. Sourced from the
 * same `users` table User Management edits, so renaming an officer there (or
 * handing a role to someone else) is what the public site shows — nothing
 * about who holds a role is typed in twice.
 */
class OfficerController extends Controller
{
    /**
     * Which roles appear on the public board, and in what order. The
     * Programming Team (the site's maintainers) and the six Team Heads are
     * deliberately excluded — this is the elected board, not every admin
     * account.
     *
     * @var list<UserRole>
     */
    private const ROSTER = [
        UserRole::Adviser,
        UserRole::President,
        UserRole::Vpea,
        UserRole::Vpia,
        UserRole::Secretary,
        UserRole::AssistantSecretary,
        UserRole::Treasurer,
        UserRole::AssistantTreasurer,
        UserRole::Auditor,
        UserRole::Pro,
        UserRole::Bod,
    ];

    public function index(): JsonResponse
    {
        $order = array_flip(array_map(fn (UserRole $r): string => $r->value, self::ROSTER));

        $officers = User::query()
            ->where('is_active', true)
            ->whereIn('role', array_keys($order))
            // Id order first, so several accounts sharing a role (the board's
            // four directors) keep the order they were added in once grouped
            // by role below — a stable sort, not a re-shuffle.
            ->orderBy('id')
            ->get(['id', 'name', 'email', 'role'])
            ->sortBy(fn (User $u): int => $order[$u->role->value])
            ->values();

        return response()->json([
            'data' => $officers->map(fn (User $u): array => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role->value,
                'roleLabel' => $u->role->label(),
                'isAdviser' => $u->role === UserRole::Adviser,
            ]),
        ]);
    }
}
