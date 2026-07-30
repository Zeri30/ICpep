<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\MembershipTerm;
use App\Models\PaymentTransaction;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Tops off the CURRENT membership term's active roster to a fixed total, for
 * exercising the Members List at a realistic page count (250 rows / 13 pages
 * at the default 20/page) rather than the handful MemberDemoSeeder provides.
 *
 * NOT for production — same live-Supabase caveat as MemberDemoSeeder. Every
 * row uses an @icpep-demo.test email, sequentially numbered so a re-run tops
 * up the gap to the target instead of duplicating or restarting the count:
 *
 *   php artisan tinker --execute="App\Models\Application::withTrashed()
 *       ->where('email','like','bulk-%@icpep-demo.test')->forceDelete();"
 */
class MemberBulkSeeder extends Seeder
{
    use WithoutModelEvents;

    private const EMAIL_DOMAIN = '@icpep-demo.test';

    /** Active members this run leaves the current term holding. */
    private const TARGET_TOTAL = 250;

    /**
     * Same NOT NULL / private-bucket constraint as MemberDemoSeeder: point at
     * a sample asset that already exists rather than leave the column empty.
     */
    private const SAMPLE_PICTURE = 'pictures/fZqn4JO3tWYg042rcE4xk0Y4dRAH98weTz7e1z8F.jpg';

    private const SAMPLE_SIGNATURE = 'signatures/HRI1YaCUkBn69HZvpk7Ny6SolKCxFI1a2CgySpiV.jpg';

    private const SURNAMES = [
        'Dela Cruz', 'Santos', 'Reyes', 'Bautista', 'Garcia', 'Mendoza', 'Torres', 'Aquino',
        'Ramos', 'Villanueva', 'Cruz', 'Flores', 'Castillo', 'Navarro', 'Domingo', 'Gonzales',
        'Rivera', 'Salazar', 'Padilla', 'Ocampo', 'Fernandez', 'Morales', 'Pascual', 'Del Rosario',
        'Marquez', 'Aguilar', 'Ignacio', 'Manalo', 'Espinosa', 'Valdez', 'Roque', 'Tolentino',
        'Nolasco', 'Guevarra', 'Lazaro', 'Panganiban', 'Concepcion', 'Bernardo', 'Agustin', 'Villareal',
    ];

    private const GIVEN_NAMES = [
        'Juan', 'Maria Clara', 'Jose Miguel', 'Andrea Nicole', 'Paolo', 'Kristine Joy', 'Rafael', 'Bianca Mae',
        'Gabriel', 'Patricia Anne', 'Miguel Antonio', 'Angelica', 'Christian Dave', 'Sophia Marie', 'Enrique', 'Camille',
        'Lorenzo', 'Trisha Mae', 'Nathaniel', 'Danica Rose', 'Francis', 'Bea Alexandra', 'Marco', 'Erika',
        'Vincent', 'Michelle Anne', 'Adrian', 'Nicole', 'Joshua', 'Kimberly', 'Renz', 'Alyssa',
        'Carlo', 'Jasmine', 'Ronald', 'Charmaine', 'Ivan', 'Precious', 'Jerome', 'Angela',
    ];

    private const BARANGAYS = [
        'Poblacion', 'San Jose', 'Bagong Silang', 'Sto. Niño', 'Malolos',
        'Bambang', 'Pandi', 'Sta. Maria', 'Bulihan', 'San Isidro',
    ];

    public function run(): void
    {
        $term = MembershipTerm::current();

        if (! $term) {
            $this->command?->warn('No current membership term — nothing to seed against.');

            return;
        }

        $existing = Application::forTerm($term->id)->count();
        $needed = self::TARGET_TOTAL - $existing;

        if ($needed <= 0) {
            $this->command?->info("{$term->label} already has {$existing} members — nothing to add.");

            return;
        }

        // Continue the numbering from whatever this seeder has already added to
        // this term, so re-running fills the remaining gap instead of colliding
        // on email/student_id.
        $start = Application::withTrashed()->forTerm($term->id)
            ->where('email', 'like', 'bulk-%'.self::EMAIL_DOMAIN)
            ->count();

        for ($n = 0; $n < $needed; $n++) {
            $this->seedOne($term->id, $start + $n);
        }

        $this->command?->info("{$needed} demo members added to {$term->label} (now ".self::TARGET_TOTAL.' total).');
    }

    private function seedOne(int $termId, int $i): void
    {
        $surname = self::SURNAMES[$i % count(self::SURNAMES)];
        $given = self::GIVEN_NAMES[($i * 7) % count(self::GIVEN_NAMES)];
        $mi = chr(65 + $i % 26);
        [$year, $section] = array_values(Application::CLASS_MAP[array_keys(Application::CLASS_MAP)[$i % 4]]);

        // Spread registrations across the last six months so the count builds
        // up gradually rather than landing as one spike "today".
        $registeredAt = Carbon::now()
            ->startOfMonth()
            ->subMonths(intdiv($i * 6, self::TARGET_TOTAL) % 6)
            ->addDays($i % 25)
            ->setTime(8 + ($i % 10), ($i * 7) % 60)
            ->min(Carbon::now()->subHours(2));

        $application = Application::create([
            'membership_term_id' => $termId,
            'surname' => $surname,
            'given_name' => $given,
            'middle_initial' => $mi,
            // 10 digits, in a range no real student ID uses, so a seeded row is
            // never mistaken for one.
            'student_id' => sprintf('9%09d', $i),
            'year_level' => $year,
            'section' => $section,
            'birthday' => Carbon::now()->subYears(19 + $i % 4)->subDays($i * 11 % 3650)->startOfDay(),
            'address' => sprintf(
                '%d %s St., Brgy. %s, Meneses, Bulacan',
                10 + ($i * 7) % 90,
                ['Rizal', 'Mabini', 'Bonifacio', 'Luna', 'Aguinaldo'][$i % 5],
                self::BARANGAYS[$i % count(self::BARANGAYS)],
            ),
            // Numbered, unlike MemberDemoSeeder's name-slug emails, since a name
            // pool this small repeats many times over 250 rows.
            'email' => sprintf('bulk-%03d%s', $i, self::EMAIL_DOMAIN),
            'phone' => sprintf('09%02d %03d %04d', 15 + $i % 20, 100 + $i * 7 % 900, 1000 + $i * 137 % 9000),
            'picture_path' => self::SAMPLE_PICTURE,
            'signature_path' => self::SAMPLE_SIGNATURE,
            // Roughly two-thirds paid, so payment filters and totals have both
            // sides to show instead of an all-or-nothing list.
            'paid_at' => ($i % 3 === 2)
                ? null
                : $registeredAt->copy()->addDays(2 + $i % 5)->min(Carbon::now()->subHour()),
        ]);

        $application->forceFill([
            'created_at' => $registeredAt,
            'updated_at' => $registeredAt,
        ])->saveQuietly();

        if ($application->paid_at) {
            $application->paymentTransactions()->create([
                'membership_term_id' => $termId,
                'action' => PaymentTransaction::PAID,
                'amount' => (float) config('icpep.membership_fee'),
                'effective_at' => $application->paid_at,
                'actor' => null,
                'member_name' => $application->full_name,
                'section' => $application->section,
                'year_level' => $application->year_level,
            ]);

            $application->paymentTransactions()->latest('id')->first()?->forceFill([
                'created_at' => $application->paid_at,
                'updated_at' => $application->paid_at,
            ])->saveQuietly();
        }
    }
}
