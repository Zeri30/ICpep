<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ActivityLogResource;
use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Read-only activity history. Filter by action (registered / updated / deleted /
 * restored / login) and search over the description and actor, mirroring the
 * Filament resource.
 */
class ActivityController extends Controller
{
    private const ACTIONS = [
        'registered', 'updated', 'deleted', 'restored', 'login', 'paid', 'unpaid',
        // User Management.
        'user_created', 'user_updated', 'user_activated', 'user_deactivated', 'user_deleted', 'password_reset',
    ];

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = ActivityLog::query()->latest();

        if (($action = $request->query('action')) && in_array($action, self::ACTIONS, true)) {
            $query->where('action', $action);
        }

        if ($search = trim((string) $request->query('search'))) {
            $query->where(function (Builder $q) use ($search): void {
                $q->where('description', 'like', "%{$search}%")
                    // The name is what the table shows, so it has to be what
                    // the search matches; email stays searchable behind it.
                    ->orWhere('actor_name', 'like', "%{$search}%")
                    ->orWhere('actor', 'like', "%{$search}%");
            });
        }

        $perPage = (int) $request->integer('perPage', 20);
        $perPage = in_array($perPage, [20, 25, 50, 100], true) ? $perPage : 20;

        return ActivityLogResource::collection($query->paginate($perPage)->withQueryString());
    }
}
