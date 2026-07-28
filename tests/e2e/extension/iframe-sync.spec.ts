import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(directory, '../../../extension');
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slowmo-extension-'));

test.describe('Chrome extension lifecycle', () => {
  let context: BrowserContext;
  let worker: Worker;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--enable-extensions',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    worker = context.serviceWorkers()[0]
      ?? await context.waitForEvent('serviceworker');
  });

  test.afterAll(async () => {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  async function newFixturePage(): Promise<Page> {
    const page = await context.newPage();
    await page.addInitScript(() => {
      (window as any).__slowmoNativeRAFForTest = window.requestAnimationFrame;
    });
    await page.goto(
      'http://localhost:5174/tests/fixtures/iframe-test-page.html',
      { waitUntil: 'load' },
    );
    return page;
  }

  async function getTabId(page: Page): Promise<number> {
    await page.bringToFront();
    const tabId = await worker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({});
      const matchingTab = tabs.find((candidate) => candidate.url === url);
      const activeTab = tabs.find((candidate) => candidate.active);
      return activeTab?.id ?? matchingTab?.id;
    }, page.url());
    expect(tabId).toBeTruthy();
    return tabId!;
  }

  async function activate(page: Page): Promise<void> {
    const tabId = await getTabId(page);
    await worker.evaluate(async (id) => {
      await (globalThis as any).__slowmoActivateTabForTests(id);
    }, tabId);
    await expect(page.locator('.slowmo-toolbar')).toHaveCount(1);
  }

  test('is inert before activation and fully restores every frame on close', async () => {
    const page = await newFixturePage();
    const child = page.frames().find((frame) => frame.url().endsWith('iframe-child.html'));
    expect(child).toBeTruthy();

    expect(await page.evaluate(() => ({
      toolbar: document.querySelectorAll('.slowmo-toolbar').length,
      runtime: Boolean((window as any).__slowmoExtensionRuntimeV1),
      nativeRAF:
        window.requestAnimationFrame === (window as any).__slowmoNativeRAFForTest,
    }))).toEqual({ toolbar: 0, runtime: false, nativeRAF: true });

    await activate(page);
    await expect.poll(() => page.evaluate(
      () => Boolean((window as any).__slowmoExtensionRuntimeV1),
    )).toBe(true);
    await expect.poll(() => child!.evaluate(
      () => Boolean((window as any).__slowmoExtensionRuntimeV1),
    )).toBe(true);

    const tabId = await worker.evaluate(async (url) => {
      const tab = (await chrome.tabs.query({})).find((candidate) => candidate.url === url);
      return tab?.id;
    }, page.url());
    await worker.evaluate(async (id) => {
      await (globalThis as any).__slowmoCommandTabForTests(
        id,
        { command: 'set-speed', speed: 0.5 },
      );
    }, tabId);
    await expect.poll(() => page.evaluate(
      () => (window as any).testHelpers.getParentAnimationPlaybackRate(),
    )).toBe(0.5);
    await expect.poll(() => child!.evaluate(
      () => document.getAnimations()[0]?.playbackRate,
    )).toBe(0.5);

    await page.locator('.slowmo-toolbar').locator('.close-button').click();
    await expect.poll(() => page.evaluate(() => ({
      runtime: Boolean((window as any).__slowmoExtensionRuntimeV1),
      nativeRAF:
        window.requestAnimationFrame === (window as any).__slowmoNativeRAFForTest,
      rate: (window as any).testHelpers.getParentAnimationPlaybackRate(),
    }))).toEqual({ runtime: false, nativeRAF: true, rate: 1 });
    await expect.poll(() => child!.evaluate(() => ({
      runtime: Boolean((window as any).__slowmoExtensionRuntimeV1),
      rate: document.getAnimations()[0]?.playbackRate,
    }))).toEqual({ runtime: false, rate: 1 });

    await page.close();
  });

  test('reopens at 1x and reloads into an inactive document', async () => {
    const page = await newFixturePage();
    await activate(page);
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('slowmo-extension-command-v1', {
        detail: { command: 'set-speed', speed: 8 },
      }));
    });
    await page.locator('.slowmo-toolbar').locator('.close-button').click();

    await activate(page);
    await expect(
      page.locator('.slowmo-toolbar').locator('.speed-half'),
    ).toHaveText('1×');

    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('.slowmo-toolbar')).toHaveCount(0);
    expect(await page.evaluate(
      () => Boolean((window as any).__slowmoExtensionRuntimeV1),
    )).toBe(false);

    await page.close();
  });

  test('re-triggering an open toolbar resets both UI and runtime to 1x', async () => {
    const page = await newFixturePage();
    await activate(page);
    const speedButton = page.locator('.slowmo-toolbar').locator('.speed-half');
    await speedButton.press('ArrowRight');
    await speedButton.press('ArrowRight');
    await speedButton.press('ArrowRight');
    await expect(speedButton).toHaveText('8×');
    await expect.poll(() => page.evaluate(
      () => (window as any).testHelpers.getParentAnimationPlaybackRate(),
    )).toBe(8);

    await activate(page);

    await expect(speedButton).toHaveText('1×');
    await expect.poll(() => page.evaluate(
      () => (window as any).testHelpers.getParentAnimationPlaybackRate(),
    )).toBe(1);
    await page.close();
  });

  test('injects newly created child frames during an active session', async () => {
    const page = await newFixturePage();
    await activate(page);
    const frameAttached = page.waitForEvent('frameattached');
    await page.click('#add-iframe-btn');
    const dynamicFrame = await frameAttached;
    await dynamicFrame.waitForLoadState('load');

    await expect.poll(() => dynamicFrame.evaluate(
      () => Boolean((window as any).__slowmoExtensionRuntimeV1),
    )).toBe(true);

    await page.close();
  });

  test('synchronizes a dynamically created cross-origin frame', async () => {
    const page = await newFixturePage();
    await activate(page);
    const frameAttached = page.waitForEvent('frameattached');
    await page.evaluate(() => {
      const frame = document.createElement('iframe');
      frame.id = 'cross-origin-frame';
      frame.src = 'http://localhost:5184/tests/fixtures/plain-iframe.html';
      document.body.appendChild(frame);
    });
    const crossOriginFrame = await frameAttached;
    await crossOriginFrame.waitForLoadState('load');

    await expect.poll(() => crossOriginFrame.evaluate(
      () => Boolean((window as any).__slowmoExtensionRuntimeV1),
    )).toBe(true);

    await page.locator('.slowmo-toolbar').locator('.play-half').click();
    await expect.poll(() => crossOriginFrame.evaluate(
      () => ({
        speed: (window as any).__slowmoExtensionRuntimeV1?.controller.getSpeed(),
        playState: document.getAnimations()[0]?.playState,
      }),
    )).toEqual({ speed: 0, playState: 'paused' });

    await page.close();
  });

  test('synchronizes nested frames', async () => {
    const page = await context.newPage();
    await page.goto(
      'http://localhost:5174/tests/fixtures/extension-test.html',
      { waitUntil: 'load' },
    );
    await activate(page);
    const nestedFrame = page.frames().find(
      (frame) => frame.url().endsWith('plain-iframe-inner.html'),
    );
    expect(nestedFrame).toBeTruthy();

    await page.locator('.slowmo-toolbar').locator('.speed-half').press('ArrowRight');

    await expect.poll(() => nestedFrame!.evaluate(() => ({
      runtime: Boolean((window as any).__slowmoExtensionRuntimeV1),
      rate: document.getAnimations()[0]?.playbackRate,
    }))).toEqual({ runtime: true, rate: 2 });
    await page.close();
  });

  test('keeps tab sessions independent', async () => {
    const firstPage = await newFixturePage();
    const secondPage = await newFixturePage();
    await activate(firstPage);
    await firstPage.locator('.slowmo-toolbar').locator('.speed-half').press('ArrowRight');
    await expect.poll(() => firstPage.evaluate(
      () => (window as any).testHelpers.getParentAnimationPlaybackRate(),
    )).toBe(2);
    expect(await secondPage.evaluate(
      () => Boolean((window as any).__slowmoExtensionRuntimeV1),
    )).toBe(false);

    await activate(secondPage);
    const secondSpeed = secondPage.locator('.slowmo-toolbar').locator('.speed-half');
    await secondSpeed.press('ArrowRight');
    await secondSpeed.press('ArrowRight');
    await expect.poll(() => secondPage.evaluate(
      () => (window as any).testHelpers.getParentAnimationPlaybackRate(),
    )).toBe(4);
    expect(await firstPage.evaluate(
      () => (window as any).testHelpers.getParentAnimationPlaybackRate(),
    )).toBe(2);

    await firstPage.close();
    await secondPage.close();
  });

  test('renders on a page that requires Trusted Types', async () => {
    const page = await context.newPage();
    await page.goto(
      'http://localhost:5174/tests/fixtures/trusted-types-page.html',
      { waitUntil: 'load' },
    );

    await activate(page);

    await expect(page.locator('.slowmo-toolbar')).toHaveCount(1);
    await expect(page.locator('.slowmo-toolbar').locator('.close-button')).toBeVisible();
    await page.close();
  });

  test('stays inactive and marks restricted Chrome pages', async () => {
    const page = await context.newPage();
    await page.goto('chrome://version', { waitUntil: 'load' });
    const tabId = await getTabId(page);

    await worker.evaluate(async (id) => {
      await (globalThis as any).__slowmoActivateTabForTests(id);
    }, tabId);

    const active = await worker.evaluate(async (id) => {
      const key = `slowmo-active-tab:${id}`;
      return typeof (await chrome.storage.session.get(key))[key] === 'string';
    }, tabId);
    expect(active).toBe(false);
    expect(await worker.evaluate(
      async (id) => chrome.action.getBadgeText({ tabId: id }),
      tabId,
    )).toBe('!');
    await page.close();
  });
});
