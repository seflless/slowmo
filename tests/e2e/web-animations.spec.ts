import { test, expect } from '@playwright/test';

test.describe('Web Animations API (element.animate()) slowdown', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tests/fixtures/test-page.html');
    // Wait for WAAPI animation to be created
    await page.waitForTimeout(100);
  });

  test('at 0.5x speed, WAAPI playbackRate is 0.5', async ({ page }) => {
    await page.evaluate(() => (window as any).slowmo(0.5));
    await page.waitForTimeout(50);

    const playbackRate = await page.evaluate(() =>
      (window as any).testHelpers.getWAAPIPlaybackRate()
    );

    expect(playbackRate).toBe(0.5);
  });

  test('at 2x speed, WAAPI playbackRate is 2', async ({ page }) => {
    await page.evaluate(() => (window as any).slowmo(2));
    await page.waitForTimeout(50);

    const playbackRate = await page.evaluate(() =>
      (window as any).testHelpers.getWAAPIPlaybackRate()
    );

    expect(playbackRate).toBe(2);
  });

  test('WAAPI currentTime progresses at slowed rate', async ({ page }) => {
    // Animation is 1s duration
    await page.evaluate(() => (window as any).slowmo(0.5));

    const initialTime = await page.evaluate(() =>
      (window as any).testHelpers.getWAAPICurrentTime()
    );

    // Wait 500ms real time
    await page.waitForTimeout(500);

    const finalTime = await page.evaluate(() =>
      (window as any).testHelpers.getWAAPICurrentTime()
    );

    // At 0.5x, 500ms real = 250ms animation time
    // Account for animation looping (1s duration)
    const timeDelta = (finalTime - initialTime + 1000) % 1000;

    // Should be ~250ms with some tolerance
    expect(timeDelta).toBeCloseTo(250, -2); // Within 100ms
  });

  test('dynamically created animation gets correct speed', async ({ page }) => {
    // First set speed
    await page.evaluate(() => (window as any).slowmo(0.25));

    // Then create a new animation
    await page.evaluate(() => {
      const box = document.createElement('div');
      box.id = 'dynamic-anim';
      box.style.cssText = 'width:50px;height:50px;background:red;';
      document.body.appendChild(box);
      box.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 2000, iterations: Infinity }
      );
    });

    // Wait for polling to pick up the new animation
    await page.waitForTimeout(100);

    // Check the new animation's playback rate
    const playbackRate = await page.evaluate(() => {
      const box = document.getElementById('dynamic-anim');
      const anims = box?.getAnimations();
      return anims?.[0]?.playbackRate;
    });

    expect(playbackRate).toBe(0.25);
  });

  test('preserves developer playbackRate changes', async ({ page }) => {
    // Set slowmo speed
    await page.evaluate(() => (window as any).slowmo(0.5));
    await page.waitForTimeout(50);

    // Create animation with custom playbackRate
    await page.evaluate(() => {
      const box = document.createElement('div');
      box.id = 'custom-rate';
      box.style.cssText = 'width:50px;height:50px;background:blue;';
      document.body.appendChild(box);
      const anim = box.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(2)' }],
        { duration: 2000, iterations: Infinity }
      );
      // Developer sets 2x playback rate
      anim.playbackRate = 2;
    });

    await page.waitForTimeout(100);

    // The effective rate should be developer rate (2) * slowmo speed (0.5) = 1
    const playbackRate = await page.evaluate(() => {
      const box = document.getElementById('custom-rate');
      const anims = box?.getAnimations();
      return anims?.[0]?.playbackRate;
    });

    expect(playbackRate).toBe(1); // 2 * 0.5 = 1
  });
});
