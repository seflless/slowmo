import { test, expect } from '@playwright/test';

test.describe('Video playback rate control', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tests/fixtures/test-page.html');
    // Wait for video element to be ready
    await page.waitForSelector('#test-video');
    // Give video time to start loading
    await page.waitForTimeout(500);
  });

  test('at 0.5x speed, video playbackRate is 0.5', async ({ page }) => {
    await page.evaluate(() => (window as any).slowmo(0.5));
    await page.waitForTimeout(100);

    const playbackRate = await page.evaluate(() =>
      (window as any).testHelpers.getVideoPlaybackRate()
    );

    expect(playbackRate).toBe(0.5);
  });

  test('at 2x speed, video playbackRate is 2', async ({ page }) => {
    await page.evaluate(() => (window as any).slowmo(2));
    await page.waitForTimeout(100);

    const playbackRate = await page.evaluate(() =>
      (window as any).testHelpers.getVideoPlaybackRate()
    );

    expect(playbackRate).toBe(2);
  });

  test('playbackRate clamped to browser minimum (0.0625)', async ({ page }) => {
    await page.evaluate(() => (window as any).slowmo(0.01));
    await page.waitForTimeout(100);

    const playbackRate = await page.evaluate(() =>
      (window as any).testHelpers.getVideoPlaybackRate()
    );

    // Should be clamped to minimum (0.0625)
    expect(playbackRate).toBe(0.0625);
  });

  test('playbackRate clamped to browser maximum (16)', async ({ page }) => {
    await page.evaluate(() => (window as any).slowmo(100));
    await page.waitForTimeout(100);

    const playbackRate = await page.evaluate(() =>
      (window as any).testHelpers.getVideoPlaybackRate()
    );

    // Should be clamped to maximum (16)
    expect(playbackRate).toBe(16);
  });

  test('video pauses when slowmo(0)', async ({ page }) => {
    // First make sure video is playing
    await page.evaluate(() => {
      const video = document.getElementById('test-video') as HTMLVideoElement;
      video.play();
    });
    await page.waitForTimeout(100);

    // Pause via slowmo
    await page.evaluate(() => (window as any).slowmo(0));
    await page.waitForTimeout(100);

    const isPaused = await page.evaluate(() => {
      const video = document.getElementById('test-video') as HTMLVideoElement;
      return video.paused;
    });

    expect(isPaused).toBe(true);
  });

  test('video resumes when unpausing', async ({ page }) => {
    // Start playing
    await page.evaluate(() => {
      const video = document.getElementById('test-video') as HTMLVideoElement;
      video.play();
    });
    await page.waitForTimeout(100);

    // Pause
    await page.evaluate(() => (window as any).slowmo(0));
    await page.waitForTimeout(100);

    // Resume
    await page.evaluate(() => (window as any).slowmo.play());
    await page.waitForTimeout(100);

    const isPaused = await page.evaluate(() => {
      const video = document.getElementById('test-video') as HTMLVideoElement;
      return video.paused;
    });

    // Video should resume (though autoplay policies might prevent this in some browsers)
    // We check if slowmo tried to resume it
    expect(isPaused).toBe(false);
  });

  test('video currentTime advances at slowed rate', async ({ page, browserName }) => {
    // Skip on WebKit - video playback timing is unreliable in headless mode
    test.skip(browserName === 'webkit', 'WebKit video timing unreliable in headless');

    // Start playing
    await page.evaluate(() => {
      const video = document.getElementById('test-video') as HTMLVideoElement;
      video.play();
    });

    await page.evaluate(() => (window as any).slowmo(0.5));
    await page.waitForTimeout(100);

    const initialTime = await page.evaluate(() =>
      (window as any).testHelpers.getVideoCurrentTime()
    );

    // Wait 600ms real time
    await page.waitForTimeout(600);

    const finalTime = await page.evaluate(() =>
      (window as any).testHelpers.getVideoCurrentTime()
    );

    const elapsed = finalTime - initialTime;

    // At 0.5x speed, 600ms real time should advance ~300ms video time
    // Allow generous tolerance due to video buffering/loading
    expect(elapsed).toBeLessThan(600 / 1000);
    expect(elapsed).toBeGreaterThan(100 / 1000); // At least 100ms (relaxed for CI)
  });

  test('Infinity speed pauses video', async ({ page }) => {
    // Wait for video to be ready and playing
    await page.evaluate(async () => {
      const video = document.getElementById('test-video') as HTMLVideoElement;
      // Wait for video metadata to load
      await new Promise<void>(r => {
        if (video.readyState >= 1) { // HAVE_METADATA
          r();
        } else {
          video.addEventListener('loadedmetadata', () => r(), { once: true });
        }
      });
      video.currentTime = 1; // Start at 1 second
      await video.play();
    });

    await page.waitForTimeout(100);

    await page.evaluate(() => (window as any).slowmo(Infinity));
    await page.waitForTimeout(200);

    const result = await page.evaluate(() => {
      const video = document.getElementById('test-video') as HTMLVideoElement;
      return {
        currentTime: video.currentTime,
        duration: video.duration,
        isPaused: video.paused,
        readyState: video.readyState
      };
    });

    // At infinity speed, video should be paused
    // This is the primary guarantee - currentTime behavior is secondary
    expect(result.isPaused).toBe(true);
  });
});
