import { injectAxe, checkA11y, configureAxe } from 'axe-playwright';

/* P4 — the "a11y addon clean" gate. `npm run test-storybook` visits every story
   in a real browser and runs axe against it; any violation fails the run. This is
   what makes the accessibility check an enforceable CI gate, not just an in-UI
   panel. `region` is disabled to match the preview config — it's a page-level
   landmark rule that doesn't apply to an isolated primitive. */
export default {
  async preVisit(page) {
    await injectAxe(page);
  },
  async postVisit(page) {
    await configureAxe(page, { rules: [{ id: 'region', enabled: false }] });
    await checkA11y(page, '#storybook-root', {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
  },
};
