<?php

namespace App\Providers\Filament;

use App\Filament\Branding;
use App\Http\Middleware\SetTenant;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

/** Borrower self-service portal at /borrower */
class BorrowerPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return Branding::apply($panel, 'My account')
            ->id('borrower')
            ->path('borrower')
            ->login()
            ->discoverPages(in: app_path('Filament/Borrower/Pages'), for: 'App\\Filament\\Borrower\\Pages')
            ->discoverWidgets(in: app_path('Filament/Borrower/Widgets'), for: 'App\\Filament\\Borrower\\Widgets')
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
                SetTenant::class,
            ])
            ->authMiddleware([Authenticate::class]);
    }
}
