<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#0a1628">
    <title>@yield('title') · Chilimbitso</title>
    <link rel="icon" href="{{ asset('images/chilimbitso-mark.png') }}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@700;800&display=swap" rel="stylesheet">
    <style>
        :root { color-scheme: light dark; --bg: #f4f6fa; --fg: #0f172a; --muted: #5b6a80; --card: #fff; --line: #e2e8f0; }
        @media (prefers-color-scheme: dark) { :root { --bg: #0a111e; --fg: #f1f4f9; --muted: #9aa8bf; --card: #111a2b; --line: #24324d; } }
        * { box-sizing: border-box; }
        body {
            margin: 0; min-height: 100dvh; display: flex; flex-direction: column; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: var(--fg);
            background:
                url("{{ asset('images/watermark-light.png') }}") no-repeat fixed center / min(72vw, 440px),
                radial-gradient(1200px 520px at 75% -200px, rgb(254 215 185 / .32), transparent 70%),
                radial-gradient(1000px 460px at -5% -140px, rgb(191 211 246 / .45), transparent 70%),
                var(--bg);
        }
        header { padding: 1.25rem 1.5rem; }
        .brand { display: inline-flex; align-items: center; gap: .65rem; color: inherit; text-decoration: none; }
        .brand img { width: 2.6rem; height: 2.6rem; border-radius: 9999px; }
        .brand b { display: block; font-family: "Plus Jakarta Sans", Inter, sans-serif; font-weight: 800; font-size: 1.1rem; letter-spacing: -.02em; }
        .brand small { display: block; font-size: .72rem; font-weight: 600; color: #c2490a; }
        main { flex: 1; display: grid; place-items: center; padding: 1.5rem 1.5rem 6rem; text-align: center; }
        .box { max-width: 32rem; animation: rise .6s cubic-bezier(.16, 1, .3, 1) both; }
        .code {
            display: block; font-family: "Plus Jakarta Sans", Inter, sans-serif; font-weight: 800; letter-spacing: -.05em; line-height: 1;
            font-size: clamp(6rem, 22vw, 10rem); background: linear-gradient(180deg, rgb(242 107 29 / .3), transparent); -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        h1 { margin: -1.75rem 0 0; font-family: "Plus Jakarta Sans", Inter, sans-serif; font-weight: 800; font-size: clamp(1.5rem, 4vw, 1.9rem); letter-spacing: -.02em; }
        p { margin: .85rem 0 0; color: var(--muted); line-height: 1.65; font-size: .95rem; }
        .actions { margin-top: 2rem; display: flex; flex-wrap: wrap; gap: .75rem; justify-content: center; }
        .btn { display: inline-flex; align-items: center; gap: .5rem; height: 2.75rem; padding: 0 1.25rem; border-radius: .8rem; font-weight: 600; font-size: .9rem; text-decoration: none; transition: filter .2s, transform .15s; }
        .btn:active { transform: scale(.97); }
        .primary { color: #fff; background: linear-gradient(180deg, #d4500e, #a43f0c); box-shadow: inset 0 1px 0 rgb(255 255 255 / .22), 0 4px 12px -4px rgb(242 107 29 / .5); }
        .primary:hover { filter: brightness(.94); }
        .secondary { color: var(--fg); background: var(--card); border: 1px solid var(--line); }
        @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .box { animation: none; } }
    </style>
</head>
<body>
    <header>
        <a class="brand" href="{{ url('/') }}" aria-label="Chilimbitso home">
            <img src="{{ asset('images/chilimbitso-mark.png') }}" alt="">
            <span><b>Chilimbitso</b><small>Money Lending</small></span>
        </a>
    </header>
    <main>
        <div class="box">
            <span class="code" aria-hidden="true">@yield('code')</span>
            <h1>@yield('title')</h1>
            <p>@yield('message')</p>
            <div class="actions">
                <a class="btn primary" href="{{ url('/app') }}">Go to dashboard</a>
                <a class="btn secondary" href="javascript:history.back()">Go back</a>
            </div>
        </div>
    </main>
</body>
</html>
