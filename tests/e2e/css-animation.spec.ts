import { test, expect } from '@playwright/test';

test.describe('CSS Animation slowdown', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tests/fixtures/test-page.html');
    // Wait for animations to be available
    await page.waitForFunction(() => document.getAnimations().length > 0);
  });

  test('at 0.5x speed, CSS animation playbackRate is 0.5', async ({ page }) => {
    // Set slowmo speed
    await page.evaluate(() => (window as any).slowmo(0.5));

    // Wait a frame for the polling to update
    await page.waitForTimeout(50);

    // Check playback rate
    const playbackRate = await page.evaluate(() =>
      (window as any).testHelpers.getCSSAnimationPlaybackRate('.css-box')
    );

    expect(playbackRate).toBe(0.5);
  });

  test('at 2x speed, CSS animation playbackRate is 2', async ({ page }) => {
    await page.evaluate(() => (window as any).slowmo(2));
    await page.waitForTimeout(50);

    const playbackRate = await page.evaluate(() =>
      (window as any).testHelpers.getCSSAnimationPlaybackRate('.css-box')
    );

    expect(playbackRate).toBe(2);
  });

  test('at 0 speed (pause), CSS animation is paused', async ({ page }) => {
    await page.evaluate(() => (window as any).slowmo(0));
    await page.waitForTimeout(50);

    const playState = await page.evaluate(() => {
      const anims = document.getAnimations();
      const cssAnim = anims.find(a =>
        (a.effect as KeyframeEffect)?.target?.matches?.('.css-box')
      );
      return cssAnim?.playState;
    });

    expect(playState).toBe('paused');
  });

  test('CSS animation progress verification', async ({ page }) => {
    // This test verifies that at 0.5x speed, animation progresses at half rate
    // Animation is 2s duration, so at 0.5x after 1s real time, we should be at 0.25s (12.5% progress)

    await page.evaluate(() => (window as any).slowmo(0.5));

    // Get initial progress
    const initialProgress = await page.evaluate(() =>
      (window as any).testHelpers.getCSSAnimationProgress('.css-box')
    );

    // Wait 500ms real time
    await page.waitForTimeout(500);

    // Get final progress
    const finalProgress = await page.evaluate(() =>
      (window as any).testHelpers.getCSSAnimationProgress('.css-box')
    );

    // At 0.5x speed, 500ms real time = 250ms animation time
    // For 2s animation, that's 12.5% progress
    // Account for timing variance (±5%)
    const expectedDelta = 0.125; // 250ms / 2000ms
    const actualDelta = (finalProgress - initialProgress + 1) % 1; // Handle wrap-around

    expect(actualDelta).toBeCloseTo(expectedDelta, 1); // Within 0.1
  });

  test('excluded element is not affected', async ({ page }) => {
    await page.evaluate(() => (window as any).slowmo(0.5));
    await page.waitForTimeout(50);

    // Get playback rate of excluded element
    const playbackRate = await page.evaluate(() =>
      (window as any).testHelpers.getCSSAnimationPlaybackRate('.excluded-box')
    );

    // Excluded element should maintain original playback rate (1)
    expect(playbackRate).toBe(1);
  });
});
