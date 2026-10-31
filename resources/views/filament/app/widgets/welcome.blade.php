<x-filament-widgets::widget>
    <section class="ch-hero" x-data @pointermove="const r = $el.getBoundingClientRect(); $el.style.setProperty('--mx', ($event.clientX - r.left) + 'px'); $el.style.setProperty('--my', ($event.clientY - r.top) + 'px')">
        <span class="ch-hero-orb ch-hero-orb-blue" aria-hidden="true"></span>
        <span class="ch-hero-orb ch-hero-orb-orange" aria-hidden="true"></span>
        <span class="ch-hero-grid" aria-hidden="true"></span>

        <div class="ch-hero-body">
            <div>
                <p class="ch-hero-date">
                    <x-filament::icon icon="heroicon-o-calendar-days" class="ch-hero-date-icon" />
                    {{ $date }}
                </p>
                <h2 class="ch-hero-title">{{ $greeting }}</h2>
                <p class="ch-hero-lead">
                    @if ($waiting > 0)
                        You have <strong>{{ $waiting }} {{ $waiting === 1 ? 'item' : 'items' }}</strong> waiting for your sign-off. Everything else is moving.
                    @else
                        Nothing is waiting for you. The book is moving on its own today.
                    @endif
                </p>
                <dl class="ch-hero-stats">
                    @foreach ($stats as $s)
                        <div>
                            <dt>{{ $s['label'] }}</dt>
                            <dd @class(['ch-accent' => $s['accent'] ?? false])>{{ $s['value'] }}</dd>
                        </div>
                    @endforeach
                </dl>
            </div>

            <div>
                <p class="ch-hero-steps-label">Your next steps</p>
                @if (count($steps))
                    <div class="ch-hero-steps">
                        @foreach ($steps as $step)
                            <a href="{{ $step['url'] }}" @class(['ch-step', 'ch-step-urgent' => $step['urgent']])>
                                <span class="ch-step-icon"><x-filament::icon :icon="$step['icon']" class="ch-step-svg" /></span>
                                <span>
                                    <span class="ch-step-title">{{ $step['title'] }}</span>
                                    <span class="ch-step-body">{{ $step['body'] }}</span>
                                </span>
                            </a>
                        @endforeach
                    </div>
                @else
                    <div class="ch-step ch-step-done">
                        <span class="ch-step-icon"><x-filament::icon icon="heroicon-o-check-badge" class="ch-step-svg" /></span>
                        <span>
                            <span class="ch-step-title">You're all caught up</span>
                            <span class="ch-step-body">New work appears here as colleagues submit it.</span>
                        </span>
                    </div>
                @endif
            </div>
        </div>
    </section>
</x-filament-widgets::widget>
