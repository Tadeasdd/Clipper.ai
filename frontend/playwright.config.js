import { defineConfig, devices } from '@playwright/test';

/* P3 — Playwright E2E + visual-regression design lock.
 *
 * Determinism is the whole game for a screenshot lock: rendering must be
 * byte-stable between where baselines are generated and where CI checks them.
 * So BOTH run inside the same pinned Playwright image
 * (mcr.microsoft.com/playwright:v1.61.0-jammy) — locally via scripts/e2e-baselines
 * and in CI via `container:`. Baselines commit as `*-linux.png`.
 *
 * Animations are frozen three ways so the heavily-animated marketing site can be
 * locked: reducedMotion (the app honors it via MotionConfig/prefersReducedMotion),
 * toHaveScreenshot({ animations: 'disabled' }), and a stylesheet injected per
 * test that kills any remaining CSS animation/transition. A residual JS-rAF
 * widget (the live pipeline demo) is masked in the spec, never the whole page.
 *
 * The browser talks to the backend at VITE_API_BASE (baked at build time); the
 * preview server only serves static assets (it does not proxy /api). */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  // Stable rendering inputs: fixed locale/timezone so any date text never drifts.
  use: {
    baseURL: BASE_URL,
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    trace: 'on-first-retry',
  },
  // The design lock's tolerance: a tiny ratio absorbs sub-pixel AA noise; a real
  // color/layout/copy change is far larger and trips the gate.
  expect: {
    // animations:'disabled' + the spec's FREEZE stylesheet stop CSS motion; the
    // JS visuals honor reducedMotion (set above) so nothing loops perpetually.
    // The richest page (home) still needs a generous settle budget: a fullPage
    // shot scroll-stitches the tall page, firing IntersectionObserver reveals
    // mid-capture, so stabilization (two identical frames) can take >5s. A larger
    // timeout only grants settle time — the maxDiffPixelRatio tolerance, which is
    // what actually polices the design, is unchanged.
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css', maxDiffPixelRatio: 0.01, timeout: 20000 },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
  ],
  // Playwright serves the built bundle; the backend (for journey tests) is booted
  // by the surrounding step/CI job and reached at VITE_API_BASE.
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
