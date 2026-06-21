import { test, expect } from '@playwright/test';

/* P3 — visual-regression DESIGN LOCK. Full-page screenshots of every marketing
   page at desktop + mobile, pinned to committed Linux baselines. A stray pixel
   change (a moved element, a recolored neon-green token, a typography shift)
   trips the gate. Baselines are generated in the same Playwright Docker image
   CI uses, so the comparison is byte-stable across machines.

   The marketing site animates, so we settle it to a fixed end-state before the
   shot: reducedMotion (config) + animations:'disabled' (config) + a stylesheet
   that kills any remaining CSS animation/transition. The only perpetual JS-rAF
   widget — the live pipeline demo in the hero — is masked (a solid box in both
   baseline and run), so it can't flake; everything around it stays locked. */
const FREEZE = `*, *::before, *::after {
  animation: none !important;
  transition: none !important;
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  scroll-behavior: auto !important;
}`;

const PAGES = [
  { path: '/', name: 'home' },
  { path: '/product', name: 'product' },
  { path: '/pricing', name: 'pricing' },
  { path: '/docs', name: 'docs' },
  { path: '/company', name: 'company' },
  { path: '/status', name: 'status' },
  { path: '/privacy', name: 'privacy' },
  { path: '/terms', name: 'terms' },
];

for (const p of PAGES) {
  test(`design lock: ${p.name}`, async ({ page }) => {
    await page.goto(p.path, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: FREEZE });
    // Web fonts must be resolved before the shot or glyph metrics drift.
    await page.evaluate(() => document.fonts && document.fonts.ready);
    // Let JS-driven number tweens (ContentMath/ViralityChart) reach their final
    // value and stop — they settle, unlike the perpetual hero demo.
    await page.waitForTimeout(1200);

    await expect(page).toHaveScreenshot(`${p.name}.png`, {
      fullPage: true,
      // Mask only the perpetual live-demo widget (present on home only; a
      // no-op selector elsewhere). The rest of the page stays under the lock.
      mask: [page.locator('.hero-parallax')],
    });
  });
}
