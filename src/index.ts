/**
 * slowmo - Universal slow-motion control for web animations
 *
 * This library intercepts time at multiple levels to slow down (or speed up)
 * all animations on a web page.
 *
 * ## How it works:
 *
 * 1. **requestAnimationFrame patching**: We replace window.requestAnimationFrame
 *    with a wrapper that passes modified timestamps to callbacks. Time-based
 *    animations that use the timestamp parameter will automatically slow down.
 *
 * 2. **performance.now() patching**: We replace performance.now() to return
 *    virtual time. Libraries that use this for timing will be affected.
 *
 * 3. **Web Animations API**: We poll document.getAnimations() and modify the
 *    playbackRate of all Animation objects. This affects CSS animations,
 *    CSS transitions, and element.animate() calls.
 *
 * 4. **Media elements**: We set playbackRate on video/audio elements.
 *
 * ## Limitations:
 *
 * - Frame-based animations (that increment by a fixed amount per frame without
 *   using timestamps) cannot be smoothly slowed down. See IDEAS.md for a
 *   potential "frame throttling" mode.
 *
 * - Animations created by libraries that cache their own time references
 *   before we patch may not be affected.
 */

let currentSpeed = 1;
let isPaused = false;
let isInstalled = false;

// Original functions we'll patch
let originalRAF: typeof requestAnimationFrame;
let originalPerformanceNow: typeof performance.now;

// Time tracking for rAF timestamp manipulation
// We maintain "virtual time" that progresses at currentSpeed relative to real time
let virtualTime = 0;
let lastRealTime = 0;
let pauseTime = 0;

/**
 * Track Animation playback rates to handle developer changes.
 *
 * The challenge: We need to multiply the developer's intended playbackRate
 * by our speed multiplier. But if we just set playbackRate, and the developer
 * also sets it, we could clobber their value or they could clobber ours.
 *
 * Solution: Track both the "original" rate (what the developer intended) and
 * what we "applied" (original * currentSpeed). On each poll:
 * - If current rate !== applied, developer changed it -> update original
 * - Then recalculate and apply: original * currentSpeed
 */
interface TrackedAnimation {
  original: number;  // Developer's intended playbackRate
  applied: number;   // What we set it to (original * currentSpeed)
}
const trackedAnimations = new WeakMap<Animation, TrackedAnimation>();

/**
 * Track media elements similarly to animations.
 * We store what rate we applied so we can detect developer changes.
 */
interface TrackedMedia {
  original: number;
  applied: number;
  wasPaused: boolean;  // Track if we paused it (vs user paused it)
}
const trackedMedia = new WeakMap<HTMLMediaElement, TrackedMedia>();

/**
 * Get virtual (slowed) time from real time.
 *
 * Virtual time progresses at `currentSpeed` relative to real time.
 * When speed changes, we update virtualTime to the current position
 * and reset lastRealTime, so the new speed applies going forward.
 */
function getVirtualTime(realTime: number): number {
  if (isPaused) return pauseTime;
  const elapsed = realTime - lastRealTime;
  return virtualTime + elapsed * currentSpeed;
}

/**
 * Update all Web Animations API animations.
 *
 * This handles CSS @keyframes animations, CSS transitions, and
 * animations created with element.animate(). We poll frequently
 * (every frame via rAF) to catch new animations quickly.
 *
 * CSS animations run on the compositor thread, but their Animation
 * objects are accessible from the main thread. Setting playbackRate
 * is synchronous and takes effect immediately.
 */
function updateWebAnimations(): void {
  if (typeof document.getAnimations !== 'function') return;

  const animations = document.getAnimations();
  for (const anim of animations) {
    // Skip excluded elements (opt-out mechanism)
    const effect = anim.effect as KeyframeEffect | null;
    if (effect?.target instanceof Element) {
      if (effect.target.closest('[data-slowmo-exclude]')) continue;
    }

    const tracked = trackedAnimations.get(anim);

    if (!tracked) {
      // New animation - capture its current rate as the "original"
      const original = anim.playbackRate;
      const applied = original * currentSpeed;
      trackedAnimations.set(anim, { original, applied });
      anim.playbackRate = applied;
    } else {
      // Existing animation - check if developer changed the rate
      if (anim.playbackRate !== tracked.applied) {
        // Developer changed it! Treat current rate as new original.
        // Edge case: if they set it to exactly what we would calculate,
        // we can't distinguish, but that's rare and harmless.
        tracked.original = anim.playbackRate;
      }

      // Recalculate and apply our speed multiplier
      const newApplied = tracked.original * currentSpeed;
      if (anim.playbackRate !== newApplied) {
        anim.playbackRate = newApplied;
        tracked.applied = newApplied;
      }
    }

    // Handle pause state
    if (isPaused) {
      if (anim.playState === 'running') anim.pause();
    } else {
      if (anim.playState === 'paused') anim.play();
    }
  }
}

/**
 * Update all video/audio elements.
 *
 * Media elements have a playbackRate property that controls speed.
 * We track the original rate similarly to animations.
 */
function updateMediaElements(): void {
  const mediaElements = document.querySelectorAll('video, audio');
  mediaElements.forEach((el) => {
    if (el.closest('[data-slowmo-exclude]')) return;
    const media = el as HTMLMediaElement;

    let tracked = trackedMedia.get(media);

    if (!tracked) {
      // New media element
      tracked = {
        original: media.playbackRate,
        applied: media.playbackRate * currentSpeed,
        wasPaused: false,
      };
      trackedMedia.set(media, tracked);
    } else {
      // Check if developer changed the rate
      if (media.playbackRate !== tracked.applied && !isPaused) {
        tracked.original = media.playbackRate;
      }
    }

    // Handle pause state
    if (isPaused) {
      if (!media.paused && !tracked.wasPaused) {
        tracked.wasPaused = true;
        media.pause();
      }
    } else {
      if (tracked.wasPaused) {
        tracked.wasPaused = false;
        media.play();
      }

      // Apply speed
      const newApplied = tracked.original * currentSpeed;
      if (media.playbackRate !== newApplied) {
        media.playbackRate = newApplied;
        tracked.applied = newApplied;
      }
    }
  });
}

/**
 * Polling loop that runs every frame.
 *
 * We use requestAnimationFrame for polling because:
 * 1. It runs at display refresh rate (60fps typically)
 * 2. It's synchronized with the browser's render cycle
 * 3. New animations are most likely to appear between frames
 *
 * Note: We use the ORIGINAL rAF to avoid our own time manipulation
 * affecting the polling frequency.
 */
function pollAnimations(): void {
  updateWebAnimations();
  updateMediaElements();
  originalRAF(pollAnimations);
}

/**
 * Install the slowmo patches.
 *
 * This patches global functions and starts the polling loop.
 * Called automatically on import, but safe to call multiple times.
 */
function install(): void {
  if (isInstalled || typeof window === 'undefined') return;

  // Capture original functions BEFORE patching
  originalRAF = window.requestAnimationFrame.bind(window);
  originalPerformanceNow = performance.now.bind(performance);

  // Initialize virtual time to current real time
  lastRealTime = originalPerformanceNow();
  virtualTime = lastRealTime;

  /**
   * Patched requestAnimationFrame.
   *
   * We intercept the callback and pass it a modified timestamp.
   * The timestamp is in "virtual time" which progresses at currentSpeed.
   *
   * For time-based animations that calculate movement from the timestamp
   * delta, this makes them run slower/faster automatically.
   */
  const patchedRAF = (callback: FrameRequestCallback): number => {
    return originalRAF((realTimestamp: number) => {
      const virtualTimestamp = getVirtualTime(realTimestamp);
      if (!isPaused) {
        callback(virtualTimestamp);
      } else {
        // When paused, keep the animation loop alive but don't advance time.
        // This allows instant resume when unpaused.
        window.requestAnimationFrame(callback);
      }
    });
  };

  window.requestAnimationFrame = patchedRAF;

  // Also patch globalThis for ES module contexts where globals might
  // be accessed differently
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).requestAnimationFrame = patchedRAF;
  }

  /**
   * Patched performance.now().
   *
   * Returns virtual time instead of real time. Libraries that use
   * performance.now() for timing (like some animation libraries)
   * will automatically be affected.
   */
  (performance as any).now = (): number => {
    return getVirtualTime(originalPerformanceNow());
  };

  // Start polling loop using ORIGINAL rAF (not our patched version)
  // so polling happens at real-time intervals regardless of speed
  originalRAF(pollAnimations);

  isInstalled = true;
}

/**
 * Set the playback speed.
 *
 * @param speed - Speed multiplier. 0.5 = half speed, 2 = double speed, 0 = pause
 *
 * When speed changes, we "checkpoint" the virtual time:
 * - Record current virtual time position
 * - Reset lastRealTime to now
 * - New speed applies from this point forward
 *
 * This ensures smooth transitions without time jumps.
 */
function setSpeed(speed: number): void {
  if (!isInstalled) install();

  // Checkpoint: capture current virtual time position before changing speed
  const realNow = originalPerformanceNow();
  virtualTime = getVirtualTime(realNow);
  lastRealTime = realNow;

  currentSpeed = speed;
  isPaused = speed === 0;

  if (isPaused) {
    pauseTime = virtualTime;
  }

  // Immediately update all tracked animations with new speed
  updateWebAnimations();
  updateMediaElements();

  // GSAP integration: if GSAP is loaded, use its native timeScale
  if (typeof (window as any).gsap !== 'undefined') {
    try {
      (window as any).gsap.globalTimeline.timeScale(speed || 0.001);
    } catch (e) {
      // GSAP not fully initialized or different version
    }
  }
}

/**
 * Pause all animations (equivalent to setSpeed(0))
 */
function pause(): void {
  setSpeed(0);
}

/**
 * Resume at current speed (or 1x if was paused from start)
 */
function play(): void {
  if (isPaused) {
    // Resume: update time tracking so virtual time continues from pause point
    const realNow = originalPerformanceNow();
    lastRealTime = realNow;
    isPaused = false;
  }
  setSpeed(currentSpeed || 1);
}

/**
 * Reset to normal speed (1x)
 */
function reset(): void {
  setSpeed(1);
}

/**
 * Get current speed multiplier
 */
function getSpeed(): number {
  return currentSpeed;
}

/**
 * Main slowmo function - set speed directly.
 *
 * @example
 * import { slowmo } from 'slowmo';
 * slowmo(0.5);  // Half speed
 * slowmo(0.1);  // 10x slower
 * slowmo(2);    // Double speed
 * slowmo(0);    // Pause
 */
export function slowmo(speed: number): void {
  setSpeed(speed);
}

// Attach methods to the function for convenient API
slowmo.setSpeed = setSpeed;
slowmo.pause = pause;
slowmo.play = play;
slowmo.reset = reset;
slowmo.getSpeed = getSpeed;

// Auto-install on import in browser environments
if (typeof window !== 'undefined') {
  install();
}

export default slowmo;
