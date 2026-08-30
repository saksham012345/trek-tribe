import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the organizer surface.
 *
 * Thirty-one screens went in across nine sprints and every check so far has
 * been a pure function, a database constraint, or an HTTP request. None of
 * those open a page. A screen that renders blank, throws in a component, or
 * calls the wrong endpoint passes all three and fails the only test that
 * matters — someone looking at it.
 *
 * Runs serially against one worker: these hit a single shared API and database,
 * and parallel runs would interfere with each other's data rather than find
 * real bugs.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },

  fullyParallel: false,
  workers: 1,
  retries: 0,

  reporter: [['list']],

  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // The dev server is slow to hydrate on first load; a short timeout here
    // reports a hydration delay as a broken page.
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
