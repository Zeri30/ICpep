<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\PaymentTransaction;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Demo members, for filling the admin during development and for exercising the
 * members list's pagination, search and filters.
 *
 * NOT for production. This writes real rows to whatever database is configured
 * — which is the live Supabase project. Every seeded row uses an
 * @icpep-demo.test email, so they are easy to tell apart from real members and
 * to remove:
 *
 *   php artisan tinker --execute="App\Models\Application::withTrashed()
 *       ->where('email','like','%@icpep-demo.test')->forceDelete();"
 *
 * Re-running the seeder updates the same rows rather than duplicating them.
 */
class MemberDemoSeeder extends Seeder
{
    use WithoutModelEvents;

    private const EMAIL_DOMAIN = '@icpep-demo.test';

    /**
     * Uploads live in a private Supabase bucket and the columns are NOT NULL, so
     * seeded rows point at a sample asset already in the bucket. They therefore
     * all share one photo — expected for demo data. If the bucket is empty the
     * paths simply resolve to nothing; the table tolerates it because the image
     * column runs with checkFileExistence(false).
     */
    private const SAMPLE_PICTURE = 'pictures/fZqn4JO3tWYg042rcE4xk0Y4dRAH98weTz7e1z8F.jpg';

    private const SAMPLE_SIGNATURE = 'signatures/HRI1YaCUkBn69HZvpk7Ny6SolKCxFI1a2CgySpiV.jpg';

    /** [surname, given name, middle initial, year, section] */
    private const MEMBERS = [
        ['Dela Cruz', 'Juan', 'S', '3rd Year', 'Section A'],
        ['Santos', 'Maria Clara', 'B', '3rd Year', 'Section A'],
        ['Reyes', 'Jose Miguel', 'T', '3rd Year', 'Section A'],
        ['Bautista', 'Andrea Nicole', 'L', '3rd Year', 'Section A'],
        ['Garcia', 'Paolo', 'R', '3rd Year', 'Section A'],
        ['Mendoza', 'Kristine Joy', 'V', '3rd Year', 'Section B'],
        ['Torres', 'Rafael', 'M', '3rd Year', 'Section B'],
        ['Aquino', 'Bianca Mae', 'D', '3rd Year', 'Section B'],
        ['Ramos', 'Gabriel', 'P', '3rd Year', 'Section B'],
        ['Villanueva', 'Patricia Anne', 'C', '3rd Year', 'Section B'],
        ['Cruz', 'Miguel Antonio', 'G', '4th Year', 'Section A'],
        ['Flores', 'Angelica', 'H', '4th Year', 'Section A'],
        ['Castillo', 'Christian Dave', 'N', '4th Year', 'Section A'],
        ['Navarro', 'Sophia Marie', 'A', '4th Year', 'Section A'],
        ['Domingo', 'Enrique', 'F', '4th Year', 'Section A'],
        ['Gonzales', 'Camille', 'J', '4th Year', 'Section B'],
        ['Rivera', 'Lorenzo', 'E', '4th Year', 'Section B'],
        ['Salazar', 'Trisha Mae', 'O', '4th Year', 'Section B'],
        ['Padilla', 'Nathaniel', 'K', '4th Year', 'Section B'],
        ['Ocampo', 'Danica Rose', 'I', '4th Year', 'Section B'],
    ];

    private const BARANGAYS = [
        'Poblacion', 'San Jose', 'Bagong Silang', 'Sto. Niño', 'Malolos',
        'Bambang', 'Pandi', 'Sta. Maria', 'Bulihan', 'San Isidro',
    ];

    public function run(): void
    {
        foreach (self::MEMBERS as $i => [$surname, $given, $mi, $year, $section]) {
            $email = $this->emailFor($given, $surname);

            // Spread registrations back across the six months the dashboard
            // chart covers, so it renders a curve instead of one spike. Anchor
            // to the start of the target month and only ever add days — sub-
            // tracting can cross into the previous month and leave a bucket
            // empty, which shows up as a dead spot on the chart.
            $registeredAt = Carbon::now()
                ->startOfMonth()
                ->subMonths(intdiv($i * 6, count(self::MEMBERS)))
                ->addDays(($i * 7) % 25)
                ->setTime(9 + ($i % 8), ($i * 7) % 60)
                // The current month's bucket starts on the 1st and adds days,
                // which can overshoot today and date a member in the future.
                ->min(Carbon::now()->subHours(2));

            $application = Application::withTrashed()->updateOrCreate(
                ['email' => $email],
                [
                    'surname' => $surname,
                    'given_name' => $given,
                    'middle_initial' => $mi,
                    'year_level' => $year,
                    'section' => $section,
                    // Students are roughly 19–22; vary the day so birthdays differ.
                    'birthday' => Carbon::now()
                        ->subYears(19 + ($i % 4))
                        ->subDays($i * 11)
                        ->startOfDay(),
                    'address' => sprintf(
                        '%d %s St., Brgy. %s, Meneses, Bulacan',
                        10 + ($i * 7) % 90,
                        ['Rizal', 'Mabini', 'Bonifacio', 'Luna', 'Aguinaldo'][$i % 5],
                        self::BARANGAYS[$i % count(self::BARANGAYS)],
                    ),
                    'phone' => sprintf('09%02d %03d %04d', 15 + ($i % 20), 100 + $i * 7, 1000 + $i * 137),
                    'picture_path' => self::SAMPLE_PICTURE,
                    'signature_path' => self::SAMPLE_SIGNATURE,
                    // Roughly two-thirds paid, so the dashboard shows a real
                    // collected-vs-pending split instead of 0% or 100%. Paid a
                    // few days after registering, never in the future.
                    'paid_at' => ($i % 3 === 2)
                        ? null
                        : $registeredAt->copy()->addDays(2 + ($i % 5))->min(Carbon::now()->subHour()),
                    'deleted_at' => null,
                ]
            );

            // updateOrCreate would otherwise stamp them all with "now".
            $application->forceFill([
                'created_at' => $registeredAt,
                'updated_at' => $registeredAt,
            ])->saveQuietly();

            $this->seedPaymentHistory($application);
        }

        $this->command?->info(count(self::MEMBERS).' demo members seeded ('.self::EMAIL_DOMAIN.').');
    }

    /**
     * Give paid demo members a matching ledger row. The seeder runs with model
     * events muted (so 20 inserts don't spam the activity log), which means the
     * transaction Application would normally append never fires — without this,
     * the payment history would be empty while the members list showed everyone
     * as paid.
     */
    private function seedPaymentHistory(Application $application): void
    {
        // Rebuilt from scratch each run so re-seeding can't stack duplicates.
        $application->paymentTransactions()->delete();

        if (! $application->paid_at) {
            return;
        }

        $application->paymentTransactions()->create([
            'action' => PaymentTransaction::PAID,
            'amount' => (float) config('icpep.membership_fee'),
            'effective_at' => $application->paid_at,
            'actor' => null, // seeded, not recorded by an officer
            'member_name' => $application->full_name,
            'section' => $application->section,
        ]);

        // The ledger row should look like it was written when the fee was taken.
        $application->paymentTransactions()->latest('id')->first()?->forceFill([
            'created_at' => $application->paid_at,
            'updated_at' => $application->paid_at,
        ])->saveQuietly();
    }

    private function emailFor(string $given, string $surname): string
    {
        $slug = fn (string $v): string => str($v)->lower()->replace(['.', "'"], '')->slug('')->toString();

        return $slug($given).'.'.$slug($surname).self::EMAIL_DOMAIN;
    }
}
