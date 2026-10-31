{{-- PWA service worker --}}
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
</script>

{{-- Offline banner --}}
<div
  x-data="{ online: navigator.onLine, back: false }"
  x-init="
    window.addEventListener('online',  () => { online = true;  back = true; setTimeout(() => back = false, 3000); });
    window.addEventListener('offline', () => { online = false; back = false; });
  "
  x-show="!online || back"
  x-transition
  class="pointer-events-none fixed inset-x-0 top-3 z-[65] flex justify-center px-4"
  role="status"
  aria-live="polite"
>
  <div
    :class="online
      ? 'bg-success-600 ring-success-500/40'
      : 'bg-gray-900 ring-white/10'"
    class="flex animate-pulse items-center gap-2.5 rounded-full px-4 py-2 text-[13px] font-medium text-white shadow-lg ring-1"
  >
    <template x-if="!online">
      <svg class="h-4 w-4 text-warning-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 8v4m0 4h.01"/></svg>
    </template>
    <template x-if="online">
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/></svg>
    </template>
    <span x-text="online ? 'Back online' : 'You\'re offline — changes won\'t save until the connection returns'"></span>
  </div>
</div>

{{-- Keyboard shortcuts (g+d, g+l, n+l, etc.) --}}
<div
  x-data="shortcuts()"
  x-init="init()"
  @keydown.window="handle($event)"
>
  {{-- Shortcut help modal --}}
  <div
    x-show="helpOpen"
    x-transition.opacity
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    @click.self="helpOpen = false"
    @keydown.escape.window="helpOpen = false"
    role="dialog"
    aria-label="Keyboard shortcuts"
  >
    <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">Keyboard shortcuts</h2>
        <button @click="helpOpen = false" class="text-gray-400 hover:text-gray-600">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="grid gap-6 sm:grid-cols-2">
        <section>
          <h3 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Go to</h3>
          <ul class="divide-y divide-gray-100 dark:divide-gray-800">
            <template x-for="s in goShortcuts" :key="s.label">
              <li class="flex items-center justify-between py-2 text-sm text-gray-700 dark:text-gray-300">
                <span x-text="s.label"></span>
                <span class="flex items-center gap-1 text-[11px] text-gray-400">
                  <kbd class="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono dark:border-gray-700 dark:bg-gray-800" x-text="s.keys[0].toUpperCase()"></kbd>
                  <span class="text-gray-400">then</span>
                  <kbd class="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono dark:border-gray-700 dark:bg-gray-800" x-text="s.keys[1].toUpperCase()"></kbd>
                </span>
              </li>
            </template>
          </ul>
        </section>
        <section>
          <h3 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Create</h3>
          <ul class="divide-y divide-gray-100 dark:divide-gray-800">
            <template x-for="s in createShortcuts" :key="s.label">
              <li class="flex items-center justify-between py-2 text-sm text-gray-700 dark:text-gray-300">
                <span x-text="s.label"></span>
                <span class="flex items-center gap-1 text-[11px] text-gray-400">
                  <kbd class="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono dark:border-gray-700 dark:bg-gray-800" x-text="s.keys[0].toUpperCase()"></kbd>
                  <span>then</span>
                  <kbd class="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono dark:border-gray-700 dark:bg-gray-800" x-text="s.keys[1].toUpperCase()"></kbd>
                </span>
              </li>
            </template>
          </ul>
          <h3 class="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">General</h3>
          <ul class="divide-y divide-gray-100 dark:divide-gray-800 text-sm text-gray-700 dark:text-gray-300">
            <li class="flex items-center justify-between py-2">? <kbd class="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] dark:border-gray-700 dark:bg-gray-800">?</kbd></li>
            <li class="flex items-center justify-between py-2">Dark / light <kbd class="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] dark:border-gray-700 dark:bg-gray-800">Shift+D</kbd></li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</div>

<script>
function shortcuts() {
  return {
    helpOpen: false,
    prefix: null,  // { key, at }
    goShortcuts: [
      { keys: ['g','d'], label: 'Dashboard',      href: '/app' },
      { keys: ['g','l'], label: 'Loans',           href: '/app/loans' },
      { keys: ['g','b'], label: 'Borrowers',       href: '/app/customers' },
      { keys: ['g','p'], label: 'Applications',    href: '/app/loan-applications' },
      { keys: ['g','r'], label: 'Repayments',      href: '/app/payments' },
      { keys: ['g','a'], label: 'Approvals',       href: '/app/approvals-page' },
    ],
    createShortcuts: [
      { keys: ['n','l'], label: 'New loan application', href: '/app/loan-applications/create' },
      { keys: ['n','b'], label: 'New borrower',         href: '/app/customers/create' },
    ],
    init() {},
    handle(e) {
      if (e.defaultPrevented || e.metaKey || e.altKey) return;
      const t = e.target;
      const typing = t instanceof HTMLElement && (t.isContentEditable || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement);
      if (typing) return;
      if (document.querySelector('[role="dialog"][open]') || document.querySelector('dialog[open]')) return;
      if (e.key === '?') { e.preventDefault(); this.helpOpen = !this.helpOpen; return; }
      if (e.key === 'D' && e.shiftKey) {
        e.preventDefault();
        const dark = document.documentElement.classList.toggle('dark');
        try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
        return;
      }
      if (e.key === 'Escape') { this.helpOpen = false; return; }
      const key = e.key.toLowerCase();
      const first = this.prefix && (Date.now() - this.prefix.at < 1200) ? this.prefix.key : null;
      if (first) {
        this.prefix = null;
        const all = [...this.goShortcuts, ...this.createShortcuts];
        const hit = all.find(s => s.keys[0] === first && s.keys[1] === key);
        if (hit?.href) { e.preventDefault(); window.location.href = hit.href; }
        return;
      }
      if (key === 'g' || key === 'n') this.prefix = { key, at: Date.now() };
    },
  };
}
</script>

{{-- Form draft saving (Alpine plugin) --}}
<script>
document.addEventListener('alpine:init', () => {
  Alpine.data('formDraft', ({ name, userId, maxAge = 43200000 }) => ({
    key: userId ? `draft:${userId}:${name}` : null,
    restoredAt: null,
    _done: false,

    init() {
      if (!this.key) return;
      const raw = this._read();
      if (raw) {
        this.restoredAt = raw.at;
        this._fill(raw.values);
      }
      this._watch();
    },

    _read() {
      try {
        const raw = localStorage.getItem(this.key);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (Date.now() - s.at > maxAge) { localStorage.removeItem(this.key); return null; }
        return s;
      } catch { return null; }
    },

    _fill(values) {
      // Best-effort: populate any named input/select/textarea with saved value
      Object.entries(values).forEach(([k, v]) => {
        const el = document.querySelector(`[name="${k}"]`);
        if (el && !k.toLowerCase().includes('signature')) el.value = v;
      });
    },

    _collect() {
      const data = {};
      document.querySelectorAll('[data-draft-form] input, [data-draft-form] select, [data-draft-form] textarea').forEach(el => {
        if (el.name && !el.name.toLowerCase().includes('signature') && !el.name.includes('_token')) {
          data[el.name] = el.value;
        }
      });
      return data;
    },

    _watch() {
      let t;
      const save = () => {
        clearTimeout(t);
        t = setTimeout(() => {
          if (this._done || !this.key) return;
          try { localStorage.setItem(this.key, JSON.stringify({ at: Date.now(), values: this._collect() })); } catch {}
        }, 400);
      };
      document.querySelectorAll('[data-draft-form] input, [data-draft-form] select, [data-draft-form] textarea').forEach(el => {
        el.addEventListener('input', save);
        el.addEventListener('change', save);
      });
    },

    clear() {
      this._done = true;
      this.restoredAt = null;
      try { if (this.key) localStorage.removeItem(this.key); } catch {}
    },

    discard() {
      this.clear();
      document.querySelectorAll('[data-draft-form] input:not([type=hidden]), [data-draft-form] select, [data-draft-form] textarea').forEach(el => {
        el.value = '';
      });
    },
  }));
});
</script>
