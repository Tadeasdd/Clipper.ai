import { test, expect } from '@playwright/test';
import { api, opsLogin, db, seedClip, clientLogin, setSessionCookie, clipStatus } from './helpers.js';

/* P3 — core user journeys, driven through the REAL built app in a real browser
   against the live backend (the app talks to VITE_API_BASE; CORS reflects the
   preview origin with credentials, so the session cookie rides cross-port).
   Each journey asserts the authoritative outcome in Postgres, the way f4/f5 do,
   not just a re-rendered string. */

let pool;
test.beforeAll(async () => { pool = await db(); });
test.afterAll(async () => { await pool?.end(); });

// ── lead → call: the public marketing funnel. No auth, no seeding — fill the
//    "book a demo" form and confirm the lead is accepted. ───────────────────
test('lead → call: marketing demo request is accepted', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const email = `e2e-lead-${Date.now()}@company.com`;
  await page.getByLabel('Work email').fill(email);
  await page.getByRole('button', { name: 'Request my call' }).click();
  // The widget only shows this on a real 201 from POST /api/leads.
  await expect(page.getByText("We'll be in touch within 48 hours to book your demo.")).toBeVisible({ timeout: 15000 });
});

// ── ops review: a human signs off on a machine-produced clip. Seed a clip in
//    review, approve it in the desk, assert the status machine advanced it. ──
test('ops review: approve advances the clip through the status machine', async ({ page, context }) => {
  const token = await opsLogin();
  const hook = `E2E review hook ${Date.now()}`;
  const { clip } = await seedClip(pool, { token, status: 'awaiting_review', hook, clientName: 'E2E Desk Co' });

  await setSessionCookie(context, token);
  await page.goto('/ops/review', { waitUntil: 'networkidle' });

  // The seeded card shows its hook; scope the approve click to that card so a
  // neighbouring clip in the queue can never be the one we act on.
  await expect(page.getByText(hook)).toBeVisible({ timeout: 15000 });
  const card = page.locator('div').filter({ hasText: hook })
    .filter({ has: page.getByRole('button', { name: 'approve', exact: true }) }).last();
  await card.getByRole('button', { name: 'approve', exact: true }).click();

  // Authoritative: the clip left awaiting_review (the atomic CTE ran).
  await expect.poll(() => clipStatus(pool, clip), { timeout: 15000 }).not.toBe('awaiting_review');
  expect(['approved_internal', 'approved']).toContain(await clipStatus(pool, clip));
});

// ── portal approve: the client signs off through their window. Seed a clip
//    awaiting the client, log in as that client, approve, assert the DB. ─────
test('portal approve: client sign-off records in Postgres', async ({ page, context }) => {
  const opsToken = await opsLogin();
  const hook = `E2E portal hook ${Date.now()}`;
  const { clientId, clip } = await seedClip(pool, { token: opsToken, status: 'awaiting_client', hook, clientName: 'E2E Portal Co' });
  const { token } = await clientLogin(pool, { opsToken, clientId });

  await setSessionCookie(context, token);
  await page.goto('/portal/review', { waitUntil: 'networkidle' });

  await expect(page.getByText(hook)).toBeVisible({ timeout: 15000 });
  const card = page.locator('section').filter({ hasText: hook })
    .filter({ has: page.getByRole('button', { name: 'approve', exact: true }) }).last();
  await card.getByRole('button', { name: 'approve', exact: true }).click();

  // The client's sign-off is the terminal review state.
  await expect.poll(() => clipStatus(pool, clip), { timeout: 15000 }).toBe('approved');
});
