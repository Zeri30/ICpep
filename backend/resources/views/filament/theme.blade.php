{{-- Carries the landing page's typography and accents into the admin. The
     palette itself is set through the panel's colors() (see AdminPanelProvider);
     this covers what that API can't express — the display/heading fonts, the
     crimson hairline, and the button glow.

     Only Filament's stable `fi-*` class hooks are targeted, so this survives
     patch upgrades. Injected rather than compiled because Filament v3 themes
     build against Tailwind 3 while this app is on Tailwind 4. --}}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link
    href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700;800;900&family=Rajdhani:wght@500;600;700&display=swap"
    rel="stylesheet"
>

<style>
    :root {
        --icpep-display: 'Orbitron', 'Rajdhani', sans-serif;
        --icpep-head: 'Rajdhani', 'Inter', sans-serif;
        --icpep-primary: #dc2626;
        --icpep-glow-sm: 0 0 18px rgba(220, 38, 38, 0.25);
        --icpep-glow: 0 0 20px rgba(220, 38, 38, 0.3);
        /* The site separates its near-black surfaces with this line colour
           rather than with contrast; Filament's default white/10 ring is too
           faint to do that job here. */
        --icpep-line: #262626;
        --icpep-card: #0a0a0a;
    }

    /* --- Surfaces -------------------------------------------------------
       Filament makes the desktop sidebar transparent (lg:bg-transparent), so
       it inherits the body's #050505 and reads as one flat black slab. Give it
       the card colour and a real edge, like the landing page's panels. */
    .fi-sidebar {
        background-color: var(--icpep-card) !important;
        border-inline-end: 1px solid var(--icpep-line);
    }

    /* --- Sidebar open/close animation ------------------------------------
       Filament animates the sidebar's width, which alone reads as an abrupt
       snap. Ease it on the site's curve and fade the labels so they don't
       squash against the edge mid-collapse. */
    .fi-sidebar,
    .fi-main-ctn,
    .fi-topbar {
        transition:
            width 400ms cubic-bezier(0.22, 1, 0.36, 1),
            transform 400ms cubic-bezier(0.22, 1, 0.36, 1),
            margin 400ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity 200ms ease;
    }

    .fi-sidebar-item-label,
    .fi-sidebar-group-label,
    .fi-sidebar-header .fi-logo {
        transition: opacity 250ms ease 80ms;
    }

    /* Collapsed: labels fade rather than clip. */
    .fi-sidebar:not(.fi-sidebar-open) .fi-sidebar-item-label,
    .fi-sidebar:not(.fi-sidebar-open) .fi-sidebar-group-label {
        opacity: 0;
        transition-delay: 0ms;
    }

    /* Respect users who ask for less motion. */
    @media (prefers-reduced-motion: reduce) {
        .fi-sidebar,
        .fi-main-ctn,
        .fi-topbar,
        .fi-sidebar-item-label,
        .fi-sidebar-group-label {
            transition: none !important;
        }
    }

    /* The topbar gets the site navbar's glass treatment instead of a flat fill. */
    .fi-topbar > nav {
        background-color: rgba(5, 5, 5, 0.72) !important;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-bottom: 1px solid var(--icpep-line);
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    }

    /* Cards, tables and widgets: swap the faint default ring for the site's line. */
    .fi-section,
    .fi-ta-ctn,
    .fi-wi-stats-overview-stat {
        --tw-ring-color: var(--icpep-line) !important;
        border-radius: 0.5rem;
    }

    /* Rows lift toward crimson on hover rather than plain white. */
    .fi-ta-row:hover {
        background-color: rgba(220, 38, 38, 0.06) !important;
    }

    /* Active nav item mirrors the landing page's red underline treatment. */
    .fi-sidebar-item-active .fi-sidebar-item-button {
        background-color: rgba(220, 38, 38, 0.1);
        box-shadow: inset 3px 0 0 0 var(--icpep-primary);
    }


    /* Page + section headings: Orbitron, matching the site's font-display. */
    .fi-header-heading,
    .fi-modal-heading,
    .fi-section-header-heading,
    .fi-wi-stats-overview-stat-value {
        font-family: var(--icpep-display);
        font-weight: 700;
        letter-spacing: 0.06em;
    }

    /* Labels, nav, buttons and stat titles: Rajdhani in the site's uppercase,
       wide-tracking treatment. */
    .fi-sidebar-item-label,
    .fi-sidebar-group-label,
    .fi-btn-label,
    .fi-wi-stats-overview-stat-label,
    .fi-ta-header-cell-label,
    .fi-fo-field-wrp-label,
    .fi-in-entry-wrp-label {
        font-family: var(--icpep-head);
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
    }

    /* The site's crimson hairline under the fixed header. */
    .fi-topbar > nav,
    .fi-sidebar-header {
        position: relative;
    }
    .fi-topbar > nav::after,
    .fi-sidebar-header::after {
        content: '';
        position: absolute;
        inset-inline: 0;
        bottom: 0;
        height: 1px;
        background: linear-gradient(to right, transparent, var(--icpep-primary), transparent);
        pointer-events: none;
    }

    /* Primary buttons carry the site's red glow. Keyed off the button-specific
       colour modifier so it can never catch a primary badge or link. */
    .fi-btn.fi-btn-color-primary {
        box-shadow: var(--icpep-glow-sm);
        transition: box-shadow 150ms ease;
    }
    .fi-btn.fi-btn-color-primary:hover {
        box-shadow: var(--icpep-glow);
    }

    /* Brand wordmark in the sidebar, to match the navbar lockup. */
    .fi-logo {
        filter: drop-shadow(0 0 10px rgba(220, 38, 38, 0.35));
    }
</style>
