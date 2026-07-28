import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '../../../extension');

export default defineConfig({
  testDir: '.',
  fullyParallel: false, // Extension tests need to run sequentially
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  use: {
    // Extensions require headed mode
    headless: false,
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    },
  },
  projects: [
    {
      name: 'chromium-extension',
      use: {
        browserName: 'chromium',
      },
    },
  ],
  webServer: [
    {
      command: 'vite --config vite.test.config.ts',
      cwd: path.resolve(__dirname, '../../..'),
      port: 5174,
      reuseExistingServer: true,
    },
    {
      command: 'vite --config vite.test.config.ts --port 5184',
      cwd: path.resolve(__dirname, '../../..'),
      port: 5184,
      reuseExistingServer: false,
    },
  ],
});
