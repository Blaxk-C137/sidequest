import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = 8799;
const BROWSERS = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/playwright/browsers';

/**
 * Prefer an explicitly configured Chrome/Chromium. Otherwise reuse whatever
 * Playwright build is already on disk (the sandbox ships one), falling back to
 * Playwright's managed download when nothing is found.
 */
function resolveChromium(): string | undefined {
  if (process.env.CHROMIUM_EXECUTABLE) return process.env.CHROMIUM_EXECUTABLE;
  try {
    const candidates = readdirSync(BROWSERS)
      .filter((entry) => entry.startsWith('chromium-'))
      .sort()
      .reverse()
      .map((entry) => path.join(BROWSERS, entry, 'chrome-linux64', 'chrome'));
    return candidates.find((candidate) => existsSync(candidate));
  } catch {
    return undefined;
  }
}
const executablePath = resolveChromium();

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `node scripts/e2e-server.mjs`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { PLAYWRIGHT_BROWSERS_PATH: BROWSERS },
  },
});
