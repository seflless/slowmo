import { test, expect } from '@playwright/test';

test.describe('requestAnimationFrame timestamp manipulation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tests/fixtures/test-page.html');
    // Wait for rAF animation to start
    await page.waitForTimeout(100);
  });

  test('at 0.5x speed, rAF timestamp delta is halved', async ({ page }) => {
    // This test verifies that rAF callbacks receive slowed-down timestamps
    const result = await page.evaluate(async () => {
      (window as any).slowmo(0.5);

      return new Promise<{ virtualDelta: number; realDuration: number }>(resolve => {
        let firstTs: number | null = null;
        let lastTs: number | null = null;
        const startReal = Date.now(); // Use Date.now for real time tracking

        function capture(ts: number) {
          if (firstTs === null) {
            firstTs = ts;
          }
          lastTs = ts;

          if (Date.now() - startReal < 500) {
            requestAnimationFrame(capture);
          } else {
            resolve({
              virtualDelta: lastTs! - firstTs!,
              realDuration: Date.now() - startReal
            });
          }
        }
        requestAnimationFrame(capture);
      });
    });

    // At 0.5x speed, ~500ms real time should produce ~250ms virtual delta
    // Allow 50ms tolerance for timing variance
    expect(result.virtualDelta).toBeLessThan(result.realDuration);
    expect(result.virtualDelta).toBeCloseTo(result.realDuration * 0.5, -2); // Within 100ms
  });

  test('at 2x speed, rAF timestamp delta is doubled', async ({ page }) => {
    const result = await page.evaluate(async () => {
      (window as any).slowmo(2);

      return new Promise<{ virtualDelta: number; realDuration: number }>(resolve => {
        let firstTs: number | null = null;
        let lastTs: number | null = null;
        const startReal = Date.now();

        function capture(ts: number) {
          if (firstTs === null) {
            firstTs = ts;
          }
          lastTs = ts;

          if (Date.now() - startReal < 300) {
            requestAnimationFrame(capture);
          } else {
            resolve({
              virtualDelta: lastTs! - firstTs!,
              realDuration: Date.now() - startReal
            });
          }
        }
        requestAnimationFrame(capture);
      });
    });

    // At 2x speed, ~300ms real time should produce ~600ms virtual delta
    expect(result.virtualDelta).toBeGreaterThan(result.realDuration);
    expect(result.virtualDelta).toBeCloseTo(result.realDuration * 2, -2); // Within 100ms
  });

  test('at 0 speed (pause), virtual time freezes', async ({ page }) => {
    // Test that performance.now() (virtual time) freezes when paused
    // Note: rAF callbacks don't fire when paused, so we test via performance.now
    const result = await page.evaluate(async () => {
      (window as any).slowmo(1);

      // Wait a bit at normal speed
      await new Promise(r => setTimeout(r, 100));
      const beforePause = performance.now();

      // Pause
      (window as any).slowmo(0);
      const pauseTime = performance.now();

      // Wait real time while paused
      await new Promise(r => setTimeout(r, 200));
      const afterPauseWait = performance.now();

      return {
        deltaBeforePause: beforePause - 0, // Time elapsed at 1x
        pauseTime,
        afterPauseWait,
        deltaWhilePaused: afterPauseWait - pauseTime
      };
    });

    // Before pause, time should have advanced
    expect(result.pauseTime).toBeGreaterThan(0);

    // While paused, performance.now should return the same value (delta = 0)
    expect(result.deltaWhilePaused).toBe(0);
  });

  test('performance.now returns virtual time', async ({ page }) => {
    // Verify that performance.now() also returns virtual time
    const result = await page.evaluate(async () => {
      (window as any).slowmo(0.5);

      const startVirtual = performance.now();
      const startReal = Date.now();

      await new Promise(r => setTimeout(r, 400));

      const endVirtual = performance.now();
      const endReal = Date.now();

      return {
        virtualDelta: endVirtual - startVirtual,
        realDelta: endReal - startReal
      };
    });

    // At 0.5x, real delta should be ~2x virtual delta
    expect(result.virtualDelta).toBeLessThan(result.realDelta);
    expect(result.virtualDelta).toBeCloseTo(result.realDelta * 0.5, -2);
  });
});
