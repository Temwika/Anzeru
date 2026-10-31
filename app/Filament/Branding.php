<?php

namespace App\Filament;

use Filament\Panel;
use Filament\Support\Colors\Color;
use Filament\View\PanelsRenderHook;

/**
 * One look for every panel: midnight navy for structure, Chilimbitso orange (from the logo) for
 * action, gold for highlights. Blue against orange stays distinct under every common form of
 * colour blindness, and the shades below keep text at WCAG AA contrast.
 */
class Branding
{
    /** Brand orange. 600 carries white text at 4.9:1; 700 is the text shade (6.4:1). */
    public const ORANGE = [
        50 => '255, 244, 236',
        100 => '255, 230, 211',
        200 => '254, 201, 165',
        300 => '253, 165, 109',
        400 => '249, 133, 64',
        500 => '242, 107, 29',
        600 => '194, 73, 10',
        700 => '164, 63, 12',
        800 => '131, 52, 17',
        900 => '107, 44, 17',
        950 => '58, 20, 6',
    ];

    public static function apply(Panel $panel, string $subtitle): Panel
    {
        return $panel
            ->colors([
                'primary' => self::ORANGE,
                'gray' => Color::Slate,
                'info' => Color::Sky,
                'success' => Color::Emerald,
                'warning' => Color::Amber,
                'danger' => Color::Rose,
            ])
            ->font('Inter')
            ->brandName('Chilimbitso Money Lending')
            ->brandLogo(fn () => view('filament.brand', ['subtitle' => $subtitle]))
            ->brandLogoHeight('2.75rem')
            ->favicon(asset('images/chilimbitso-mark.png'))
            ->darkMode(true)
            ->sidebarCollapsibleOnDesktop()
            ->globalSearchKeyBindings(['mod+k', 'ctrl+k'])
            ->renderHook(PanelsRenderHook::HEAD_END, fn () => view('filament.theme'))
            ->renderHook(PanelsRenderHook::BODY_END, fn () => view('filament.idle-lock'));
    }
}
