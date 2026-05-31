// Minimal `window.storage` polyfill.
//
// The original design artifact used a Claude-artifact-only `window.storage`
// API. The studio's run history was migrated to the real backend, but a few
// marketing-page calls remain (the waitlist email capture). Rather than edit
// that UI, we polyfill the same tiny API on top of localStorage so those
// calls keep working in a real browser.
//
// Imported for side effects from ClipperApp. Guarded so it's a no-op during
// SSR (no `window`).

if (typeof window !== 'undefined' && !window.storage) {
  const mem = {};
  let backend = null;
  try {
    window.localStorage.setItem('__clipper_probe', '1');
    window.localStorage.removeItem('__clipper_probe');
    backend = window.localStorage;
  } catch {
    backend = null; // private mode / disabled — fall back to in-memory
  }

  const read = (k) => (backend ? backend.getItem(k) : (k in mem ? mem[k] : null));
  const write = (k, v) => (backend ? backend.setItem(k, String(v)) : (mem[k] = String(v)));
  const del = (k) => (backend ? backend.removeItem(k) : delete mem[k]);

  // Signatures mirror the original API (the trailing `shared` arg is ignored).
  window.storage = {
    async get(key) {
      const value = read(key);
      return value == null ? null : { key, value };
    },
    async set(key, value) {
      write(key, value);
      return { key, value };
    },
    async delete(key) {
      del(key);
      return { key, deleted: true };
    },
    async list(prefix = '') {
      const keys = [];
      if (backend) {
        for (let i = 0; i < backend.length; i++) {
          const k = backend.key(i);
          if (k && k.startsWith(prefix)) keys.push(k);
        }
      } else {
        for (const k of Object.keys(mem)) if (k.startsWith(prefix)) keys.push(k);
      }
      return { keys };
    },
  };
}
