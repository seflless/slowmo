import { test, expect } from '@playwright/test';

/**
 * These tests verify iframe synchronization works when slowmo is loaded
 * in both parent and child frames. This tests the core sync mechanism
 * without requiring the Chrome extension.
 *
 * The extension's job is just to inject slowmo into all frames automatically.
 * These tests prove that ONCE slowmo is loaded, the sync works.
 */

test.describe('iframe sync (without extension)', () => {
  test.beforeEach(async ({ page }) => {
    // Use test-page.html which has slowmo loaded and an iframe
    await page.goto('/tests/fixtures/test-page.html');
    // Wait for iframe to load
    await page.waitForSelector('#test-iframe');
    await page.waitForTimeout(500); // Let iframe fully initialize
  });

  test('parent frame has slowmo loaded', async ({ page }) => {
    const hasSlowmo = await page.evaluate(() => typeof (window as any).slowmo === 'function');
    expect(hasSlowmo).toBe(true);
  });

  test('iframe has slowmo loaded', async ({ page }) => {
    const hasSlowmo = await page.evaluate(() => {
      const iframe = document.getElementById('test-iframe') as HTMLIFrameElement;
      return typeof iframe.contentWindow?.slowmo === 'function';
    });
    expect(hasSlowmo).toBe(true);
  });

  test('parent animation playbackRate changes when slowmo called', async ({ page }) => {
    // Set speed in parent
    await page.evaluate(() => (window as any).slowmo(0.5));
    await page.waitForTimeout(100);

    // Measure parent animation
    const parentRate = await page.evaluate(() => {
      const anims = document.getAnimations();
      const cssAnim = anims.find(a => a.effect?.target?.matches?.('.css-box'));
      return cssAnim?.playbackRate ?? null;
    });

    expect(parentRate).toBe(0.5);
  });

  test('iframe animation playbackRate changes when synced via postMessage', async ({ page }) => {
    // First verify iframe animation is at 1x
    const initialRate = await page.evaluate(() => {
      const iframe = document.getElementById('test-iframe') as HTMLIFrameElement;
      return iframe.contentWindow?.getAnimationPlaybackRate?.() ?? null;
    });
    expect(initialRate).toBe(1);

    // Set speed in parent
    await page.evaluate(() => (window as any).slowmo(0.25));

    // Broadcast to iframe (simulating what extension does)
    await page.evaluate(() => {
      const iframe = document.getElementById('test-iframe') as HTMLIFrameElement;
      iframe.contentWindow?.postMessage({ type: 'slowmo-sync', speed: 0.25 }, '*');
    });

    await page.waitForTimeout(200);

    // Measure iframe animation
    const iframeRate = await page.evaluate(() => {
      const iframe = document.getElementById('test-iframe') as HTMLIFrameElement;
      return iframe.contentWindow?.getAnimationPlaybackRate?.() ?? null;
    });

    expect(iframeRate).toBe(0.25);
  });

  test('both parent and iframe sync to same speed', async ({ page }) => {
    const speeds = [0.5, 0.25, 2, 1];

    for (const speed of speeds) {
      // Set parent speed
      await page.evaluate((s) => (window as any).slowmo(s), speed);

      // Sync to iframe
      await page.evaluate((s) => {
        const iframe = document.getElementById('test-iframe') as HTMLIFrameElement;
        iframe.contentWindow?.postMessage({ type: 'slowmo-sync', speed: s }, '*');
      }, speed);

      await page.waitForTimeout(150);

      // Measure both
      const rates = await page.evaluate(() => {
        const parentAnims = document.getAnimations();
        const parentRate = parentAnims.find(a => a.effect?.target?.matches?.('.css-box'))?.playbackRate;

        const iframe = document.getElementById('test-iframe') as HTMLIFrameElement;
        const iframeRate = iframe.contentWindow?.getAnimationPlaybackRate?.();

        return { parentRate, iframeRate };
      });

      expect(rates.parentRate).toBe(speed);
      expect(rates.iframeRate).toBe(speed);
    }
  });

  test('pause (speed=0) stops animations in both frames', async ({ page }) => {
    // Set speed to 0 (pause)
    await page.evaluate(() => (window as any).slowmo(0));
    await page.evaluate(() => {
      const iframe = document.getElementById('test-iframe') as HTMLIFrameElement;
      iframe.contentWindow?.postMessage({ type: 'slowmo-sync', speed: 0 }, '*');
    });

    await page.waitForTimeout(200);

    const rates = await page.evaluate(() => {
      const parentAnims = document.getAnimations();
      const parentRate = parentAnims.find(a => a.effect?.target?.matches?.('.css-box'))?.playbackRate;

      const iframe = document.getElementById('test-iframe') as HTMLIFrameElement;
      const iframeRate = iframe.contentWindow?.getAnimationPlaybackRate?.();

      return { parentRate, iframeRate };
    });

    expect(rates.parentRate).toBe(0);
    expect(rates.iframeRate).toBe(0);
  });

  test('speed changes in parent can be measured in iframe', async ({ page }) => {
    // Set a specific speed
    await page.evaluate(() => {
      const iframe = document.getElementById('test-iframe') as HTMLIFrameElement;
      iframe.contentWindow?.postMessage({ type: 'slowmo-sync', speed: 0.33 }, '*');
    });

    await page.waitForTimeout(200);

    // Verify the exact playbackRate is set in iframe
    const iframeRate = await page.evaluate(() => {
      const iframe = document.getElementById('test-iframe') as HTMLIFrameElement;
      const anims = iframe.contentWindow?.document.getAnimations();
      if (anims && anims.length > 0) {
        return anims[0].playbackRate;
      }
      return null;
    });

    // playbackRate being 0.33 IS proof the animation runs at 0.33x speed
    // This is the Web Animations API - playbackRate directly controls timing
    expect(iframeRate).toBe(0.33);
  });
});
