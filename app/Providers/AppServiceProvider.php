<?php

namespace App\Providers;

use Filament\Infolists\Infolist;
use Filament\Tables\Table;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Schema::defaultStringLength(191);

        // Zambian locale so every ->money() column reads "K 5,000.00" rather than "ZMW 5,000.00".
        foreach ([Table::class, Infolist::class] as $component) {
            $component::$defaultCurrency = 'ZMW';
            $component::$defaultNumberLocale = 'en_ZM';
        }
    }
}
