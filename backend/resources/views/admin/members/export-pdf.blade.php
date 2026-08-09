<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Members List</title>
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
       vertical-align: middle on a <td> is well supported and keeps both
       perfectly aligned regardless of how many chips wrap onto a line. */
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

    table.members { width: 100%; border-collapse: collapse; margin-top: 4px; }
    table.members thead { display: table-header-group; }
    table.members tr { page-break-inside: avoid; }
    table.members th, table.members td {
        border: 1px solid #ddd; padding: 5px 6px; text-align: left; font-size: 9.5px; vertical-align: middle;
    }
    table.members th { background: #b91c1c; color: #fff; text-transform: uppercase; font-size: 8.5px; }
    table.members tbody tr:nth-child(even) { background: #f9f9f9; }
    table.members td.status-paid { color: #15803d; font-weight: bold; }
    table.members td.status-unpaid { color: #b91c1c; font-weight: bold; }
    /* Sized to sit inside the row's own height (padding + the 9.5px text)
       rather than stretching it — a signature here is a small confirmation
       mark, not an illustration. */
    table.members td.signature img { height: 14px; width: auto; max-width: 90px; }
    table.members td.signature .none { color: #999; }

    .total { margin-top: 10px; font-size: 10.5px; font-weight: bold; text-align: right; }

    .signatures { width: 100%; margin-top: 56px; }
    .signatures table { width: 100%; border-collapse: collapse; }
    .signatures td { width: 50%; text-align: center; font-size: 10px; padding-top: 0; }
    .signatures .line { border-top: 1px solid #333; margin: 0 24px; padding-top: 4px; }
    .signatures .role { color: #555; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }

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
                <div class="report-title">Members List</div>
                {{-- The app runs on UTC (config/app.php); the roster is read in the
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

@if ($rows->isEmpty())
    <p class="empty">No members match the current filters.</p>
@else
    <table class="members">
        <thead>
            <tr>
                <th>#</th>
                <th>Name</th>
                <th>Section</th>
                <th>Year Level</th>
                <th>Status</th>
                <th>Balance</th>
                <th>Semester</th>
                <th>E-Signature</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($rows as $row)
                <tr>
                    <td>{{ $row['number'] }}</td>
                    <td>{{ $row['name'] }}</td>
                    <td>{{ $row['section'] }}</td>
                    <td>{{ $row['yearLevel'] }}</td>
                    <td class="{{ $row['status'] === 'Paid' ? 'status-paid' : 'status-unpaid' }}">{{ $row['status'] }}</td>
                    <td>{{ number_format($row['balance'], 2) }}</td>
                    <td>{{ $row['semester'] }}</td>
                    <td class="signature">
                        @if ($row['signature'])
                            <img src="{{ $row['signature'] }}" alt="Signature">
                        @else
                            <span class="none">&mdash;</span>
                        @endif
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endif

<div class="total">Total members: {{ $rows->count() }}</div>

<div class="signatures">
    <table>
        <tr>
            <td>
                <div class="line">
                    &nbsp;
                </div>
                <div class="role">Secretary</div>
            </td>
            <td>
                <div class="line">
                    &nbsp;
                </div>
                <div class="role">President</div>
            </td>
        </tr>
    </table>
</div>

</body>
</html>
