{{-- Custom sign-out button shown at the top-right of the admin panel, with a
     confirmation prompt. Also hides the default user-menu logout so there is a
     single, confirmed way to sign out. --}}
<style>
    .fi-user-menu { display: none !important; }
</style>

<form
    method="POST"
    action="{{ route('filament.admin.auth.logout') }}"
    onsubmit="return confirm('Are you sure you want to sign out?');"
    class="fi-ta-actions flex items-center"
>
    @csrf
    <button
        type="submit"
        title="Sign out"
        class="fi-icon-btn relative flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-500 outline-none transition-colors hover:bg-gray-100 hover:text-danger-600 focus-visible:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-danger-400"
    >
        <x-heroicon-o-arrow-right-on-rectangle class="h-5 w-5" />
        <span class="hidden sm:inline">Sign out</span>
    </button>
</form>
