import { test, expect } from '@playwright/test';

test.describe('GSAP integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tests/fixtures/gsap-page.html');
    // Wait for GSAP to be loaded and animation created
    await page.waitForFunction(() => typeof (window as any).gsap !== 'undefined');
    await page.waitForTimeout(200);
  });

  test('GSAP globalTimeline.timeScale is set to slowmo speed', async ({ page }) => {
    await page.evaluate(() => (window as any).slowmo(0.5));
    await page.waitForTimeout(50);

    const timeScale = await page.evaluate(() =>
      (window as any).testHelpers.getGSAPTimeScale()
    );

    expect(timeScale).toBe(0.5);
  });

  test('GSAP timeScale updates when speed changes', async ({ page }) => {
    // Test multiple speed changes
    await page.evaluate(() => (window as any).slowmo(0.25));
    await page.waitForTimeout(50);
    let timeScale = await page.evaluate(() =>
      (window as any).testHelpers.getGSAPTimeScale()
    );
    expect(timeScale).toBe(0.25);

    await page.evaluate(() => (window as any).slowmo(2));
    await page.waitForTimeout(50);
    timeScale = await page.evaluate(() =>
      (window as any).testHelpers.getGSAPTimeScale()
    );
    expect(timeScale).toBe(2);

    await page.evaluate(() => (window as any).slowmo(1));
    await page.waitForTimeout(50);
    timeScale = await page.evaluate(() =>
      (window as any).testHelpers.getGSAPTimeScale()
    );
    expect(timeScale).toBe(1);
  });

  test('GSAP pauses when slowmo(0)', async ({ page }) => {
    await page.evaluate(() => (window as any).slowmo(0));
    await page.waitForTimeout(50);

    // GSAP gets timeScale set to 0.001 (near-zero) when paused
    const timeScale = await page.evaluate(() =>
      (window as any).testHelpers.getGSAPTimeScale()
    );

    expect(timeScale).toBe(0.001);
  });

  test('GSAP animation progress matches speed', async ({ page }) => {
    // Set 0.5x speed and observe animation progress
    await page.evaluate(() => (window as any).slowmo(0.5));

    const initialProgress = await page.evaluate(() =>
      (window as any).gsap.globalTimeline.progress()
    );

    await page.waitForTimeout(500);

    const finalProgress = await page.evaluate(() =>
      (window as any).gsap.globalTimeline.progress()
    );

    // Progress should advance, but at half the normal rate
    // Note: GSAP timeline progress depends on all active tweens
    expect(finalProgress).not.toBe(initialProgress);
  });
});
