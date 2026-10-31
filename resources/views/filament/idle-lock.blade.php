{{--
    Signs staff out after 15 minutes without activity, with a one-minute "Still there?" warning that
    needs a click: a mouse brushing past doesn't count. Shared across tabs through localStorage.
--}}
@if (auth()->check())
    <div
        x-data="{
            idleMs: 15 * 60 * 1000,
            warnMs: 60 * 1000,
            left: null,
            local: Date.now(),
            done: false,
            read() { try { return Number(localStorage.getItem('last-activity')) || this.local } catch (e) { return this.local } },
            write(t) { try { localStorage.setItem('last-activity', String(t)) } catch (e) {} },
            init() {
                this.write(this.local);
                let lastWrite = 0;
                const activity = () => {
                    if (this.left !== null) return;
                    this.local = Date.now();
                    if (this.local - lastWrite > 5000) { lastWrite = this.local; this.write(this.local); }
                };
                ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((e) => window.addEventListener(e, activity, { passive: true }));
                document.addEventListener('visibilitychange', () => this.tick());
                setInterval(() => this.tick(), 1000);
            },
            tick() {
                const idle = Date.now() - Math.max(this.local, this.read());
                if (idle >= this.idleMs) {
                    if (!this.done) { this.done = true; try { sessionStorage.setItem('idle-signout', '1') } catch (e) {} this.$refs.logout.submit(); }
                    return;
                }
                this.left = idle >= this.idleMs - this.warnMs ? Math.ceil((this.idleMs - idle) / 1000) : null;
            },
            stay() { this.local = Date.now(); this.write(this.local); this.left = null; },
        }"
    >
        <form x-ref="logout" method="post" action="{{ filament()->getLogoutUrl() }}" class="hidden">@csrf</form>
        <template x-if="left !== null">
            <div class="ch-idle" role="alertdialog" aria-modal="true" aria-labelledby="ch-idle-title">
                <div class="ch-idle-backdrop"></div>
                <div class="ch-idle-card">
                    <div class="ch-idle-ring">
                        <svg viewBox="0 0 100 100" aria-hidden="true">
                            <circle cx="50" cy="50" r="44" class="ch-idle-track" />
                            <circle cx="50" cy="50" r="44" pathLength="100" class="ch-idle-bar" :stroke-dasharray="(left / 60 * 100) + ' 100'" />
                        </svg>
                        <span x-text="left"></span>
                    </div>
                    <h2 id="ch-idle-title">Still there?</h2>
                    <p>For borrowers' privacy you'll be signed out in <span x-text="left"></span> seconds.</p>
                    <button type="button" class="ch-idle-stay" @click="stay()" x-init="$nextTick(() => $el.focus())">Stay signed in</button>
                    <button type="button" class="ch-idle-out" @click="$refs.logout.submit()">Sign out now</button>
                </div>
            </div>
        </template>
    </div>
@else
    {{-- After an idle sign-out, the sign-in page says why. --}}
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            let flagged = false;
            try { flagged = sessionStorage.getItem('idle-signout') === '1'; sessionStorage.removeItem('idle-signout'); } catch (e) {}
            const form = document.querySelector('.fi-simple-main form');
            if (!flagged || !form) return;
            const note = document.createElement('p');
            note.className = 'ch-idle-note';
            note.setAttribute('role', 'status');
            note.textContent = 'You were signed out after 15 minutes without activity, to keep borrower data private. Sign in to pick up where you left off.';
            form.prepend(note);
        });
    </script>
@endif
