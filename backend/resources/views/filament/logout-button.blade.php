{{-- Top-right of the admin: a greeting for the signed-in officer plus a
     sign-out button that opens a confirmation modal.

     The button lives in the topbar (USER_MENU_BEFORE), but the modal itself is
     rendered at BODY_END — see logout-modal.blade.php. The topbar is its own
     stacking context, so a modal nested here renders *behind* the page content
     even at z-40; opening it by id from outside the topbar is what keeps it on
     top. Filament's own user menu is hidden so there's one way to sign out. --}}
<style>
    .fi-user-menu { display: none !important; }
</style>

@php
    $user = filament()->auth()->user();
    $name = $user?->name ?: 'Admin';
@endphp

<div class="flex items-center gap-3">
    {{-- Hidden on small screens, where the topbar has no room for it. --}}
    <div class="hidden flex-col items-end leading-tight sm:flex">
        <span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
            Welcome back
        </span>
        <span class="text-sm font-semibold text-gray-100">
            {{ $name }}
        </span>
    </div>

    <x-filament::button
        color="gray"
        size="sm"
        icon="heroicon-o-arrow-right-on-rectangle"
        tooltip="Sign out"
        x-on:click="$dispatch('open-modal', { id: 'icpep-confirm-logout' })"
    >
        Sign out
    </x-filament::button>
</div>
