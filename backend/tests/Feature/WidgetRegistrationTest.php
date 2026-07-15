<?php

namespace Tests\Feature;

use Filament\Facades\Filament;
use Livewire\Mechanisms\ComponentRegistry;
use Tests\TestCase;

/**
 * Every widget rendered in the panel must be resolvable as a Livewire component.
 *
 * When one is not, Livewire's lazy-load request fails with ComponentNotFound,
 * which it reports as a 419 — surfacing in the browser as the misleading
 * "This page has expired" dialog rather than anything naming the real problem.
 * These tests pin that down so it fails here instead of in someone's face.
 */
class WidgetRegistrationTest extends TestCase
{
    public function test_every_panel_widget_resolves_as_a_livewire_component(): void
    {
        Filament::setCurrentPanel(Filament::getPanel('admin'));
        $registry = app(ComponentRegistry::class);

        $widgets = Filament::getPanel('admin')->getWidgets();
        $this->assertNotEmpty($widgets);

        foreach ($widgets as $widget) {
            // The name Livewire will receive in the lazy-load snapshot.
            $name = $registry->getName($widget);

            $this->assertSame(
                $widget,
                $registry->getClass($name),
                "Widget [{$widget}] is not resolvable as Livewire component [{$name}]. "
                ."Its lazy-load would 419 as \"This page has expired\". Register it in AdminPanelProvider::widgets().",
            );
        }
    }

    public function test_the_payment_summary_header_widget_is_registered(): void
    {
        Filament::setCurrentPanel(Filament::getPanel('admin'));

        // Regression: this widget is only *rendered* as a header widget on the
        // Payment History page, which made it easy to leave unregistered.
        $this->assertSame(
            \App\Filament\Widgets\PaymentSummary::class,
            app(ComponentRegistry::class)->getClass('app.filament.widgets.payment-summary'),
        );
    }
}
