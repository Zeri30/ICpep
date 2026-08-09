<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Payment History</title>
<style>
    @page { margin: 28px 32px; }
    body { font-family: "DejaVu Sans", sans-serif; font-size: 11px; color: #1a1a1a; }

    .header { width: 100%; border-bottom: 2px solid #b91c1c; padding-bottom: 10px; margin-bottom: 12px; }
    .header table { width: 100%; border-collapse: collapse; }
    .header td { vertical-align: middle; }
    .header .logo { width: 56px; }
    .header .logo img { width: 48px; height: 48px; }
    .header .org-name { font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .header .org-sub { font-size: 10px; color: #555; }
    .header .report-title { text-align: right; font-size: 18px; font-weight: bold; text-transform: uppercase; }
    .header .generated { text-align: right; font-size: 9px; color: #555; margin-top: 2px; }

    /* Dompdf's support for inline-block + vertical-align on plain text is
       unreliable, so the label and its chips are laid out as table cells —
       see MemberController's export-pdf view for the fuller note. */
    table.filters { width: 100%; margin: 10px 0 14px; border-collapse: collapse; }
    table.filters td { vertical-align: middle; padding: 0; }
    table.filters .filters-label {
        font-size: 10px; font-weight: bold; color: #333; white-space: nowrap; padding-right: 8px;
    }
    table.filters .filters-chips { font-size: 10px; color: #333; }
    table.filters .chip {
        display: inline-block; vertical-align: middle; line-height: 1.4;
        border: 1px solid #ccc; border-radius: 3px;
        padding: 2px 8px; margin: 0 6px 4px 0; background: #f7f7f7;
    }

    table.transactions { width: 100%; border-collapse: collapse; margin-top: 4px; }
    table.transactions thead { display: table-header-group; }
    table.transactions tr { page-break-inside: avoid; }
    table.transactions th, table.transactions td {
        border: 1px solid #ddd; padding: 5px 6px; text-align: left; font-size: 9.5px;
    }
    table.transactions th { background: #b91c1c; color: #fff; text-transform: uppercase; font-size: 8.5px; }
    table.transactions tbody tr:nth-child(even) { background: #f9f9f9; }
    table.transactions td.amount { text-align: right; white-space: nowrap; }

    /* Not a sum of `amount` — see PaymentTransaction's own note on why this
       ledger's amounts are descriptive, never aggregated. A total here would
       misreport the moment a back-dated correction's paired rows land on
       different pages of the same export. */
    .total { margin-top: 10px; font-size: 10.5px; font-weight: bold; text-align: right; }

    .empty { text-align: center; padding: 24px; color: #777; }
</style>
</head>
<body>

<div class="header">
    <table>
        <tr>
            <td class="logo">
                @if (file_exists(public_path('images/icpep-logo.png')))
                    <img src="{{ public_path('images/icpep-logo.png') }}" alt="Logo">
                @endif
            </td>
            <td>
                <div class="org-name">ICpEP.SE &ndash; BulSU Meneses Campus</div>
                <div class="org-sub">Institute of Computer Engineers of the Philippines &ndash; Student Edition</div>
            </td>
            <td>
                <div class="report-title">Payment History</div>
                {{-- The app runs on UTC (config/app.php); the ledger is read in the
                     Philippines, so the printed timestamp is converted explicitly
                     rather than trusting the server's local time. --}}
                <div class="generated">Generated {{ $generatedAt->clone()->setTimezone('Asia/Manila')->format('F j, Y g:i A') }}</div>
            </td>
        </tr>
    </table>
</div>

@if (count($filters))
    <table class="filters">
        <tr>
            <td class="filters-label">Applied filters:</td>
            <td class="filters-chips">
                @foreach ($filters as $label => $value)
                    <span class="chip">{{ $label }}: {{ $value }}</span>
                @endforeach
            </td>
        </tr>
    </table>
@endif

@if ($transactions->isEmpty())
    <p class="empty">No transactions match the current filters.</p>
@else
    <table class="transactions">
        <thead>
            <tr>
                <th>#</th>
                <th>Member</th>
                <th>Section</th>
                <th>Year Level</th>
                <th>Event</th>
                <th>Batch</th>
                <th>Amount</th>
                <th>Semester</th>
                <th>Recorded</th>
                <th>By</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($transactions as $i => $row)
                <tr>
                    <td>{{ $i + 1 }}</td>
                    <td>{{ $row->member_name }}</td>
                    <td>{{ $row->section }}</td>
                    <td>{{ $row->year_level }}</td>
                    <td>{{ $actionLabels[$row->action] ?? ucfirst($row->action) }}</td>
                    <td>{{ $kindLabels[$row->kind] ?? $row->kind }}</td>
                    <td class="amount">{{ number_format((float) $row->amount, 2) }}</td>
                    <td>{{ $row->membershipTerm?->label ?? '—' }}</td>
                    <td>{{ $row->created_at?->clone()->setTimezone('Asia/Manila')->format('M j, Y g:i A') }}</td>
                    <td>
                        @php($actorName = $row->actor_name ?: $row->actor)
                        @if ($actorName)
                            {{ $actorName }}
                            @if ($row->actor_role)
                                <br><span style="color:#777;">{{ \App\Enums\UserRole::tryFrom($row->actor_role)?->label() ?? $row->actor_role }}</span>
                            @endif
                        @else
                            System
                        @endif
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endif

<div class="total">Total transactions: {{ $transactions->count() }}</div>

</body>
</html>
