{{-- Sign-out confirmation, rendered at BODY_END so it sits outside the
     topbar's stacking context and can actually paint over the page. It's
     opened from the topbar button (logout-button.blade.php) by dispatching
     open-modal with this id. --}}

{{-- Lives outside the modal and is submitted by id, so the confirm button can
     post it without nesting a form inside the modal's footer. --}}
<form
    id="icpep-logout-form"
    method="POST"
    action="{{ route('filament.admin.auth.logout') }}"
    class="hidden"
>
    @csrf
</form>

<x-filament::modal
    id="icpep-confirm-logout"
    icon="heroicon-o-arrow-right-on-rectangle"
    icon-color="danger"
    alignment="center"
    footer-actions-alignment="center"
    width="sm"
>
    <x-slot name="heading">
        Sign out
    </x-slot>

    <x-slot name="description">
        You'll be returned to the sign-in page and will need your credentials to get back in.
    </x-slot>

    <x-slot name="footerActions">
        {{-- form-id, not form: Filament maps the HTML form attribute from
             $formId, while $form is its Livewire loading-indicator target. --}}
        <x-filament::button
            type="submit"
            form-id="icpep-logout-form"
            color="danger"
            icon="heroicon-o-arrow-right-on-rectangle"
        >
            Sign out
        </x-filament::button>

        <x-filament::button
            color="gray"
            outlined
            x-on:click="$dispatch('close-modal', { id: 'icpep-confirm-logout' })"
        >
            Cancel
        </x-filament::button>
    </x-slot>
</x-filament::modal>
