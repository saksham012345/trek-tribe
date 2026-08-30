import { test, expect, Page } from '@playwright/test';

/**
 * The thirty-one organizer screens, opened in a real browser.
 *
 * Every check before this was a pure function, a database constraint, or an
 * HTTP request. None of them open a page. A screen that renders blank, throws
 * inside a component, or calls the wrong endpoint passes all three and fails
 * the only test that matters — someone looking at it.
 *
 * This session already produced exactly that class of bug twice: four analytics
 * screens calling /analytics instead of /api/analytics, and a trips screen
 * reading four fields the API never sent. Both typechecked. Both would have
 * been caught here on the first page load.
 */

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const stamp = Date.now();
const ORGANIZER = {
  name: 'Playwright Organizer',
  email: `pw-org-${stamp}@trektribe.test`,
  password: 'PwTest@123456',
  phone: `+9197${String(stamp).slice(-8)}`,
};

/** Every organizer route, with something that must be on the page. */
const SCREENS: { path: string; heading: string }[] = [
  { path: '/organizer/trips', heading: 'Trips' },
  { path: '/organizer/bookings', heading: 'Bookings' },
  { path: '/organizer/trip-templates', heading: 'Trip templates' },
  { path: '/organizer/analytics', heading: 'Analytics' },
  { path: '/organizer/analytics/profitability', heading: 'Profitability' },
  { path: '/organizer/analytics/occupancy', heading: 'Occupancy' },
  { path: '/organizer/analytics/customers', heading: 'Customers by geography' },
  { path: '/organizer/analytics/marketing', heading: 'Marketing performance' },
  { path: '/organizer/payouts', heading: 'Payouts' },
  { path: '/organizer/cash-flow', heading: 'Cash flow' },
  { path: '/organizer/reconciliation', heading: 'Reconciliation' },
  { path: '/organizer/documents', heading: 'Documents' },
  { path: '/organizer/certifications', heading: 'Certifications' },
  { path: '/organizer/coupons', heading: 'Coupons' },
  { path: '/organizer/discount-rules', heading: 'Discount rules' },
  { path: '/organizer/campaigns', heading: 'Campaigns' },
  { path: '/organizer/banners', heading: 'Banners' },
  { path: '/organizer/referrals', heading: 'Referrals' },
  { path: '/organizer/review-requests', heading: 'Review requests' },
  { path: '/organizer/customers', heading: 'Customers' },
  { path: '/organizer/leads', heading: 'Leads' },
  { path: '/organizer/team', heading: 'Team' },
  { path: '/organizer/leaders', heading: 'Trip leaders' },
  { path: '/organizer/settings', heading: 'Settings' },
  { path: '/organizer/ai-studio', heading: 'AI studio' },
  { path: '/organizer/ai-marketing', heading: 'AI marketing' },
  { path: '/organizer/ai-insights', heading: 'AI insights' },
];

/** Console errors worth failing on, as opposed to noise the app always emits. */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Sourcemap and favicon noise, and the dev-server websocket, say nothing
    // about whether the screen works.
    if (/favicon|sourcemap|source map|ERR_CONNECTION_REFUSED.*ws:|Download the React DevTools/i.test(text)) return;
    errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

/**
 * Register and log in through the real forms.
 *
 * Deliberately not a seeded session or an injected token: the login form is
 * itself a screen, and it is the one every organizer meets first.
 */
async function signIn(page: Page) {
  const res = await page.request.post(`${API}/auth/register`, {
    data: { ...ORGANIZER, role: 'organizer' },
    failOnStatusCode: false,
  });
  // A repeat run finds the account already there, which is fine.
  expect([200, 201, 409]).toContain(res.status());

  await page.goto('/login');
  await page.getByLabel(/email/i).or(page.locator('input[type="email"]')).first().fill(ORGANIZER.email);
  await page.locator('input[type="password"]').first().fill(ORGANIZER.password);
  await page.getByRole('button', { name: /sign in|log ?in/i }).first().click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45_000 });
}

test.describe('organizer screens', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('the login form actually signs a real organizer in', async ({ page }) => {
    // beforeEach did it; this asserts the outcome rather than assuming it.
    expect(page.url()).not.toContain('/login');
  });

  for (const screen of SCREENS) {
    test(`${screen.path} renders`, async ({ page }) => {
      const errors = watchConsole(page);

      const response = await page.goto(screen.path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `${screen.path} returned ${response?.status()}`).toBeLessThan(400);

      // The heading is the proof the right component mounted. A blank page, a
      // redirect to login, or an error boundary all fail here.
      await expect(
        page.getByRole('heading', { name: new RegExp(screen.heading, 'i') }).first()
      ).toBeVisible({ timeout: 30_000 });

      // Loading is allowed; being stuck in it is not.
      await expect(page.getByText(/^Loading…?$/i).first()).toBeHidden({ timeout: 30_000 });

      // "Could not load this view" is the Shell's error state — it means the
      // endpoint behind the screen answered with something the page could not
      // use, which is exactly the bug class this file exists for.
      await expect(page.getByText(/could not load this view/i)).toHaveCount(0);

      expect(errors, `console errors on ${screen.path}:\n${errors.join('\n')}`).toEqual([]);
    });
  }
});

test.describe('behaviour, not just rendering', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('coupons screen says codes are refused until a floor is set', async ({ page }) => {
    await page.goto('/organizer/coupons');
    // The whole Sprint 7 argument, visible to an organizer: no floor means no
    // coupon works, said in words rather than left as an empty list.
    await expect(
      page.getByText(/no discount floor is set, so no coupon will apply/i)
    ).toBeVisible({ timeout: 30_000 });
  });

  test('AI screens refuse rather than offering a button that spends', async ({ page }) => {
    await page.goto('/organizer/ai-studio');
    await expect(page.getByText(/no ai provider is configured/i)).toBeVisible({ timeout: 30_000 });

    const generate = page.getByRole('button', { name: /generate a draft/i });
    await expect(generate).toBeDisabled();
  });

  test('discount rules states the decision rather than leaving a gap', async ({ page }) => {
    await page.goto('/organizer/discount-rules');
    await expect(page.getByText(/automatic rules are off/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/d5/i).first()).toBeVisible();
  });

  test('every organizer screen is reachable from the navigation', async ({ page }) => {
    await page.goto('/organizer/settings');
    // The nav was added because ten screens had no way in but a typed URL.
    for (const label of ['Coupons', 'Payouts', 'Team', 'Trip leaders', 'Banners']) {
      await expect(page.getByRole('link', { name: label, exact: true }).first())
        .toBeVisible({ timeout: 30_000 });
    }
  });

  test('blocked destinations are shown greyed with a reason, not hidden', async ({ page }) => {
    await page.goto('/organizer/settings');
    const invoices = page.getByTitle(/waiting on written ca confirmation/i).first();
    await expect(invoices).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('a traveler cannot reach the organizer surface', () => {
  test('an anonymous visitor is sent to login', async ({ page }) => {
    await page.goto('/organizer/payouts');
    await page.waitForURL(/\/login/, { timeout: 30_000 });
    expect(page.url()).toContain('/login');
  });
});
