<?php

namespace App\Providers\Filament;

use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use App\Filament\Widgets\MembersByClass;
use App\Filament\Widgets\PaymentSummary;
use App\Filament\Widgets\RegistrationsOverTime;
use App\Filament\Widgets\StatsOverview;
use Filament\Enums\ThemeMode;
use Filament\Pages\Dashboard;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Filament\View\PanelsRenderHook;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return $panel
            ->default()
            ->id('admin')
            ->path('admin')
            ->login()
            ->brandName('ICpEP.SE Admin')
            ->brandLogo(asset('images/icpep-logo.png'))
            ->brandLogoHeight('2.5rem')
            ->favicon(asset('images/icpep-logo.png'))
            // The public site is dark-only, so a light admin would read as a
            // different product. Forced, not just defaulted.
            ->defaultThemeMode(ThemeMode::Dark)
            ->darkMode(true, isForced: true)
            ->font('Inter')
            // Adds the toggle that hides the sidebar entirely and brings it back.
            ->sidebarFullyCollapsibleOnDesktop()
            ->colors([
                // Tailwind's red scale — the exact family the site is built on
                // (600 = #dc2626, 500 = #ef4444 glow, 700 = #b91c1c accent).
                'primary' => Color::Red,
                // Filament's chrome is drawn from the gray scale, so pinning it
                // to the site's tokens is what makes the panel feel like the
                // landing page rather than default Filament.
                'gray' => [
                    50 => '#f5f5f5',  // foreground
                    100 => '#e5e5e5',
                    200 => '#d4d4d4',
                    300 => '#a3a3a3', // secondary-foreground
                    400 => '#737373', // muted-foreground
                    500 => '#525252',
                    600 => '#404040',
                    700 => '#262626', // line
                    800 => '#1a1a1a', // secondary
                    900 => '#0a0a0a', // card
                    950 => '#050505', // background
                ],
            ])
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\\Filament\\Resources')
            ->pages([
                Dashboard::class,
            ])
            // Registering a widget here also registers it as a Livewire
            // component. A widget used only as a page's header widget still has
            // to be listed: without it Livewire cannot resolve the component on
            // its lazy-load request and reports the failure as a 419, which the
            // browser shows as "This page has expired".
            ->widgets([
                StatsOverview::class,
                PaymentSummary::class,
                MembersByClass::class,
                RegistrationsOverTime::class,
            ])
            ->renderHook(
                PanelsRenderHook::HEAD_END,
                fn (): string => view('filament.theme')->render(),
            )
            ->renderHook(
                PanelsRenderHook::USER_MENU_BEFORE,
                fn (): string => view('filament.logout-button')->render(),
            )
            ->renderHook(
                PanelsRenderHook::BODY_END,
                fn (): string => view('filament.logout-modal')->render(),
            )
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                VerifyCsrfToken::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([
                Authenticate::class,
            ]);
    }
}
