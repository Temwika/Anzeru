{{-- Chilimbitso theme for every Filament panel. Plain CSS over Filament's own classes, no build step. --}}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
<style>
:root {
  --ch-navy-950: #0a1628;
  --ch-navy-900: #0f1f38;
  --ch-navy-800: #17294a;
  --ch-orange: #f26b1d;
  --ch-bg: #f4f6fa;
  --ch-line: #e2e8f0;
  --ch-shadow-card: 0 1px 2px rgb(10 22 40 / .04), 0 2px 6px -2px rgb(10 22 40 / .05);
  --ch-shadow-lift: 0 18px 40px -16px rgb(10 22 40 / .22), 0 4px 10px -4px rgb(10 22 40 / .06);
  --ch-ease: cubic-bezier(.16, 1, .3, 1);
  --ch-display: "Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif;
}

/* Page: cool white with a blue-to-orange wash at the top and the emblem as a faint watermark. */
body.fi-body {
  background:
    url("{{ asset('images/watermark-light.png') }}") no-repeat fixed center / min(72vw, 440px),
    radial-gradient(1200px 520px at 75% -200px, rgb(254 215 185 / .32), transparent 70%),
    radial-gradient(1000px 460px at -5% -140px, rgb(191 211 246 / .45), transparent 70%),
    var(--ch-bg) !important;
  font-feature-settings: "cv11", "ss01";
}
@media (min-width: 1024px) {
  body.fi-body { background-position: calc(50% + 10rem) center, 0 0, 0 0, 0 0 !important; }
}
.dark body.fi-body {
  background:
    url("{{ asset('images/watermark-dark.png') }}") no-repeat fixed center / min(72vw, 440px),
    radial-gradient(1200px 520px at 75% -200px, rgb(242 107 29 / .08), transparent 70%),
    radial-gradient(1000px 460px at -5% -140px, rgb(59 110 220 / .12), transparent 70%),
    #0a111e !important;
}
::selection { background: rgb(254 201 165); color: rgb(58 20 6); }

/* Brand lock-up */
.fi-logo { height: auto !important; }
.ch-brand { display: inline-flex; align-items: center; gap: .65rem; min-width: 0; }
.ch-brand-mark { width: 2.6rem; height: 2.6rem; border-radius: 9999px; flex-shrink: 0; box-shadow: 0 0 0 3px rgb(242 107 29 / .15); }
.ch-brand-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.1; }
.ch-brand-name { font-family: var(--ch-display); font-weight: 800; font-size: 1.1rem; letter-spacing: -.02em; color: var(--ch-navy-950); }
.ch-brand-tag { font-size: .72rem; font-weight: 600; color: #c2490a; }
.ch-brand-sub { font-size: .68rem; color: #5b6a80; margin-top: .1rem; }
.dark .ch-brand-name { color: #fff; }
.dark .ch-brand-tag { color: #fda56d; }
.dark .ch-brand-sub { color: #9aa8bf; }

/* Sidebar: midnight navy in both themes, an orange glow at the top and a blue one at the foot. */
.fi-sidebar {
  background:
    radial-gradient(420px 260px at 0% 0%, rgb(242 107 29 / .16), transparent 70%),
    radial-gradient(420px 340px at 100% 100%, rgb(47 107 224 / .22), transparent 70%),
    var(--ch-navy-950) !important;
  box-shadow: none !important;
  border-right: 1px solid rgb(255 255 255 / .05);
}
.fi-sidebar-header {
  background: transparent !important;
  box-shadow: none !important;
  border-bottom: 1px solid rgb(255 255 255 / .07);
  --tw-ring-color: transparent !important;
  min-height: 4.5rem;
}
.fi-sidebar .ch-brand-name { color: #fff; }
.fi-sidebar .ch-brand-tag { color: #fda56d; }
.fi-sidebar .ch-brand-sub { color: #94a3b8; }
.fi-sidebar-nav { scrollbar-width: thin; scrollbar-color: rgb(255 255 255 / .12) transparent; }
.fi-sidebar-group-label { color: #8794ab !important; font-size: .68rem !important; letter-spacing: .12em; text-transform: uppercase; }
.fi-sidebar-group-collapse-button, .fi-sidebar-group-icon { color: #8794ab !important; }
.fi-sidebar-item-button { border-radius: .8rem !important; transition: background-color .2s, transform .2s var(--ch-ease) !important; }
.fi-sidebar-item-label { color: rgb(226 232 240 / .82) !important; font-weight: 500; }
.fi-sidebar-item-icon { color: #8794ab !important; transition: color .2s, filter .2s; }
.fi-sidebar-item:not(.fi-active) .fi-sidebar-item-button:hover { background: rgb(255 255 255 / .06) !important; transform: translateX(2px); }
.fi-sidebar-item:not(.fi-active) .fi-sidebar-item-button:hover .fi-sidebar-item-label { color: #fff !important; }
.fi-sidebar-item.fi-active .fi-sidebar-item-button {
  background: linear-gradient(90deg, rgb(242 107 29 / .24), rgb(242 107 29 / .04)) !important;
  box-shadow: inset 0 0 0 1px rgb(242 107 29 / .2);
  position: relative;
}
.fi-sidebar-item.fi-active .fi-sidebar-item-button::before {
  content: ""; position: absolute; left: -.75rem; top: .4rem; bottom: .4rem; width: 4px; border-radius: 0 4px 4px 0;
  background: var(--ch-orange); box-shadow: 0 0 12px 2px rgb(242 107 29 / .55);
}
.fi-sidebar-item.fi-active .fi-sidebar-item-label { color: #fff !important; }
.fi-sidebar-item.fi-active .fi-sidebar-item-icon { color: #f98540 !important; filter: drop-shadow(0 0 6px rgb(249 133 64 / .6)); }
.fi-sidebar-item-grouped-border div { background: rgb(255 255 255 / .12) !important; }

/* Top bar: frosted glass over the page. */
.fi-topbar > nav {
  background: rgb(255 255 255 / .72) !important;
  backdrop-filter: saturate(1.6) blur(14px);
  -webkit-backdrop-filter: saturate(1.6) blur(14px);
  box-shadow: 0 1px 0 var(--ch-line) !important;
  --tw-ring-color: transparent !important;
}
.dark .fi-topbar > nav { background: rgb(17 26 43 / .72) !important; box-shadow: 0 1px 0 rgb(255 255 255 / .06) !important; }

/* Headings in the display face. */
.fi-header-heading, .fi-simple-header-heading, .fi-section-header-heading, .fi-wi-stats-overview-stat-value, .fi-modal-heading, .fi-ta-header-heading {
  font-family: var(--ch-display) !important; letter-spacing: -.02em;
}
.fi-header-heading { font-weight: 800 !important; }

/* Cards: softer corners, layered shadow, and a lift on hover for figures. */
.fi-section, .fi-ta-ctn, .fi-wi-stats-overview-stat, .fi-fo-tabs, .fi-in-entry-wrp {
  border-radius: 1.1rem !important;
  box-shadow: var(--ch-shadow-card) !important;
  --tw-ring-color: var(--ch-line) !important;
}
.dark .fi-section, .dark .fi-ta-ctn, .dark .fi-wi-stats-overview-stat { --tw-ring-color: rgb(255 255 255 / .07) !important; box-shadow: 0 1px 2px rgb(0 0 0 / .4) !important; }
.fi-wi-stats-overview-stat { position: relative; overflow: hidden; transition: transform .35s var(--ch-ease), box-shadow .35s var(--ch-ease) !important; }
.fi-wi-stats-overview-stat::before {
  content: ""; position: absolute; inset: 0 0 auto 0; height: 3px;
  background: linear-gradient(90deg, #2f6be0, var(--ch-orange), #f4b740); opacity: .85;
}
.fi-wi-stats-overview-stat:hover { transform: translateY(-3px); box-shadow: var(--ch-shadow-lift) !important; }
.fi-wi-stats-overview-stat-value { font-weight: 800 !important; font-variant-numeric: tabular-nums; }

/* Tables: quiet uppercase headers, a warm hover on rows. */
.fi-ta-header-cell-label { text-transform: uppercase; letter-spacing: .06em; font-size: .7rem !important; color: #5b6a80; }
.dark .fi-ta-header-cell-label { color: #9aa8bf; }
.fi-ta-row { transition: background-color .15s; }
.fi-ta-row:hover { background: rgb(255 244 236 / .6) !important; }
.dark .fi-ta-row:hover { background: rgb(242 107 29 / .06) !important; }

/* Primary buttons: bright at the top, deep at the foot, white text at 5:1. */
.fi-btn.fi-btn-color-primary:not(.fi-btn-outlined) {
  background-image: linear-gradient(180deg, #d4500e, #a43f0c) !important;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .22), 0 1px 2px rgb(164 63 12 / .45), 0 4px 12px -4px rgb(242 107 29 / .5) !important;
  transition: filter .2s, box-shadow .2s, transform .15s !important;
}
.fi-btn.fi-btn-color-primary:not(.fi-btn-outlined):hover { filter: brightness(.94); box-shadow: inset 0 1px 0 rgb(255 255 255 / .22), 0 10px 24px -8px rgb(242 107 29 / .65) !important; }
.fi-btn:active { transform: scale(.97); }
.fi-input-wrp { border-radius: .8rem !important; transition: box-shadow .2s; }
.fi-input-wrp:focus-within { box-shadow: 0 0 0 4px rgb(242 107 29 / .15) !important; }
:focus-visible { outline-color: var(--ch-orange); }

/* Welcome band: navy, lit blue to orange, with a soft spotlight that follows the pointer. */
.ch-hero {
  position: relative; overflow: hidden; isolation: isolate; border-radius: 1.5rem; padding: 2rem;
  background: var(--ch-navy-950); color: #fff;
  box-shadow: 0 30px 60px -30px rgb(10 22 40 / .6); outline: 1px solid rgb(255 255 255 / .05);
  animation: ch-rise .55s var(--ch-ease) both;
}
.ch-hero::after {
  content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: 0; transition: opacity .3s;
  background: radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), rgb(249 133 64 / .16), transparent 60%);
}
.ch-hero:hover::after { opacity: 1; }
.ch-hero-orb { position: absolute; z-index: -2; border-radius: 9999px; filter: blur(64px); pointer-events: none; animation: ch-float 7s ease-in-out infinite; }
.ch-hero-orb-blue { width: 28rem; height: 28rem; left: -8rem; top: -10rem; background: rgb(47 107 224 / .32); }
.ch-hero-orb-orange { width: 24rem; height: 24rem; right: -6rem; top: -8rem; background: rgb(242 107 29 / .26); animation-delay: -3.5s; }
.ch-hero-grid {
  position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: .5;
  background-image: linear-gradient(rgb(255 255 255 / .04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / .04) 1px, transparent 1px);
  background-size: 32px 32px; mask-image: radial-gradient(ellipse at top right, #000, transparent 75%);
}
@keyframes ch-float { 0%, 100% { transform: translate3d(0, 0, 0); } 50% { transform: translate3d(0, -18px, 0) scale(1.04); } }
.ch-hero-body { display: grid; gap: 2rem; align-items: center; }
@media (min-width: 1024px) { .ch-hero-body { grid-template-columns: 1fr 1.15fr; } .ch-hero { padding: 2.25rem 2.5rem; } }
.ch-hero-date { display: flex; align-items: center; gap: .5rem; font-size: .875rem; color: #94a3b8; }
.ch-hero-date-icon { width: 1rem; height: 1rem; }
.ch-hero-title { margin-top: .75rem; font-family: var(--ch-display); font-weight: 800; letter-spacing: -.03em; font-size: clamp(1.75rem, 3.4vw, 2.6rem); line-height: 1.08; }
.ch-hero-lead { margin-top: .6rem; max-width: 32rem; color: #cbd5e1; line-height: 1.6; }
.ch-hero-lead strong { color: #f4b740; font-weight: 600; }
.ch-hero-stats { display: flex; flex-wrap: wrap; margin-top: 1.75rem; }
.ch-hero-stats > div { padding: 0 1.4rem; border-left: 1px solid rgb(255 255 255 / .1); }
.ch-hero-stats > div:first-child { padding-left: 1rem; }
.ch-hero-stats dt { font-size: .85rem; color: #94a3b8; }
.ch-hero-stats dd { margin-top: .2rem; font-family: var(--ch-display); font-weight: 700; font-size: 1.6rem; font-variant-numeric: tabular-nums; }
.ch-hero-stats dd.ch-accent { color: #f4b740; }
.ch-hero-steps-label { font-size: .7rem; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: #94a3b8; margin-bottom: .75rem; }
.ch-hero-steps { display: grid; gap: .75rem; }
@media (min-width: 640px) { .ch-hero-steps { grid-template-columns: 1fr 1fr; } }
.ch-step {
  display: flex; gap: .85rem; align-items: flex-start; padding: 1rem; border-radius: 1rem;
  background: rgb(255 255 255 / .05); border: 1px solid rgb(255 255 255 / .1); color: #fff;
  transition: transform .3s var(--ch-ease), background-color .2s, border-color .2s;
}
a.ch-step:hover { transform: translateY(-2px); background: rgb(255 255 255 / .09); border-color: rgb(255 255 255 / .2); }
.ch-step-urgent { background: rgb(220 149 18 / .1); border-color: rgb(244 183 64 / .3); }
a.ch-step-urgent:hover { background: rgb(220 149 18 / .16); border-color: rgb(244 183 64 / .5); }
.ch-step-icon { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; flex-shrink: 0; border-radius: .7rem; background: rgb(255 255 255 / .1); color: #fda56d; }
.ch-step-urgent .ch-step-icon { background: #dc9512; color: var(--ch-navy-950); box-shadow: 0 6px 16px -4px rgb(220 149 18 / .6); }
.ch-step-svg { width: 1.15rem; height: 1.15rem; }
.ch-step-title { display: block; font-weight: 600; font-size: .95rem; line-height: 1.3; }
.ch-step-body { display: block; margin-top: .2rem; font-size: .8rem; line-height: 1.45; color: #94a3b8; }
@media (max-width: 639px) {
  .ch-hero { padding: 1.4rem; border-radius: 1.4rem; }
  .ch-hero-stats { display: grid; grid-template-columns: repeat(3, 1fr); }
  .ch-hero-stats > div { padding: 0 .75rem; }
  .ch-hero-stats dd { font-size: 1.25rem; }
}

/* Idle sign-out warning */
.ch-idle { position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.ch-idle-backdrop { position: absolute; inset: 0; background: rgb(10 22 40 / .6); backdrop-filter: blur(4px); }
.ch-idle-card {
  position: relative; width: 100%; max-width: 24rem; padding: 1.5rem; border-radius: 1.5rem; text-align: center;
  background: #fff; box-shadow: 0 32px 72px -20px rgb(10 22 40 / .4); animation: ch-rise .35s var(--ch-ease) both;
}
.dark .ch-idle-card { background: #111a2b; color: #f1f4f9; }
.ch-idle-ring { position: relative; display: grid; place-items: center; width: 6rem; height: 6rem; margin: 0 auto; }
.ch-idle-ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }
.ch-idle-track, .ch-idle-bar { fill: none; stroke-width: 6; }
.ch-idle-track { stroke: #f1f5f9; }
.dark .ch-idle-track { stroke: #1d2a42; }
.ch-idle-bar { stroke: var(--ch-orange); stroke-linecap: round; transition: stroke-dasharray 1s linear; }
.ch-idle-ring span { font-family: var(--ch-display); font-weight: 800; font-size: 1.9rem; font-variant-numeric: tabular-nums; }
.ch-idle-card h2 { margin-top: 1rem; font-family: var(--ch-display); font-weight: 800; font-size: 1.25rem; }
.ch-idle-card p { margin-top: .4rem; font-size: .875rem; line-height: 1.6; color: #5b6a80; }
.dark .ch-idle-card p { color: #9aa8bf; }
.ch-idle-stay, .ch-idle-out { display: block; width: 100%; margin-top: .6rem; height: 2.9rem; border-radius: .8rem; font-weight: 600; font-size: .95rem; }
.ch-idle-stay { margin-top: 1.4rem; color: #fff; background: linear-gradient(180deg, #d4500e, #a43f0c); box-shadow: inset 0 1px 0 rgb(255 255 255 / .22), 0 4px 12px -4px rgb(242 107 29 / .5); }
.ch-idle-out { color: #5b6a80; }
.ch-idle-out:hover { background: rgb(15 23 42 / .05); }
.ch-idle-note { margin-bottom: 1rem; padding: .75rem .9rem; border-radius: .8rem; font-size: .85rem; line-height: 1.55; color: #0c4a6e; background: #f0f9ff; border: 1px solid #bae6fd; }

/* Sign-in pages: the navy brand panel behind a bright card. */
.fi-simple-layout {
  background:
    radial-gradient(520px 520px at 10% 0%, rgb(242 107 29 / .28), transparent 70%),
    radial-gradient(520px 520px at 100% 60%, rgb(47 107 224 / .3), transparent 70%),
    radial-gradient(460px 460px at 30% 110%, rgb(220 149 18 / .16), transparent 70%),
    var(--ch-navy-950) !important;
}
.fi-simple-main {
  border-radius: 1.5rem !important;
  box-shadow: 0 32px 72px -20px rgb(0 0 0 / .55) !important;
  --tw-ring-color: rgb(255 255 255 / .08) !important;
  animation: ch-rise .6s var(--ch-ease) both;
}
.fi-simple-header .fi-logo { margin-bottom: .5rem; }

/* Motion: pages ease in, figures rise one after another. Off for anyone who prefers less motion. */
@keyframes ch-rise { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes ch-page { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.fi-main { animation: ch-page .45s var(--ch-ease) both; }
.fi-wi-stats-overview-stat { animation: ch-rise .55s var(--ch-ease) both; }
.fi-wi-stats-overview-stat:nth-child(2) { animation-delay: .06s; }
.fi-wi-stats-overview-stat:nth-child(3) { animation-delay: .12s; }
.fi-wi-stats-overview-stat:nth-child(4) { animation-delay: .18s; }
.fi-wi-stats-overview-stat:nth-child(5) { animation-delay: .24s; }
.fi-wi-stats-overview-stat:nth-child(6) { animation-delay: .3s; }
@media (prefers-reduced-motion: reduce) { *, *::before { animation: none !important; transition: none !important; } }

/* More contrast for those who ask their system for it. */
@media (prefers-contrast: more) {
  .fi-sidebar-item-label { color: #fff !important; }
  .fi-sidebar-group-label { color: #cbd5e1 !important; }
  .fi-section, .fi-ta-ctn, .fi-wi-stats-overview-stat { --tw-ring-color: #94a3b8 !important; }
}
</style>
