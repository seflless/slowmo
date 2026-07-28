/**
 * slowmo - reversible, universal time control for web pages.
 *
 * Importing this module is side-effect free. A controller acquires the shared
 * runtime only when activate() or a playback command is called, and releases
 * its ownership with destroy().
 */

export type SlowmoStatus = 'inactive' | 'active';

export interface SlowmoSnapshot {
  status: SlowmoStatus;
  speed: number;
  paused: boolean;
}

export type SlowmoSubscriber = (snapshot: SlowmoSnapshot) => void;

export interface SlowmoWallClock {
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(handle: number): void;
}

export interface SlowmoController {
  activate(): void;
  setSpeed(speed: number): void;
  pause(): void;
  play(): void;
  reset(): void;
  destroy(): void;
  getSpeed(): number;
  getSnapshot(): SlowmoSnapshot;
  subscribe(subscriber: SlowmoSubscriber): () => void;
}

interface TrackedPlayback {
  originalRate: number;
  appliedRate: number;
  pausedBySlowmo: boolean;
}

interface NativeTiming {
  requestAnimationFrame: typeof window.requestAnimationFrame;
  cancelAnimationFrame: typeof window.cancelAnimationFrame;
  performanceNow: typeof performance.now;
  performanceNowDescriptor?: PropertyDescriptor;
  dateNow: typeof Date.now;
  setTimeout: typeof window.setTimeout;
  clearTimeout: typeof window.clearTimeout;
  setInterval: typeof window.setInterval;
}

interface SharedRuntime {
  readonly version: 1;
  acquire(owner: symbol): void;
  release(owner: symbol): void;
  hasOwner(owner: symbol): boolean;
  setSpeed(owner: symbol, speed: number): void;
  getSpeed(): number;
  getWallClock(): SlowmoWallClock;
  subscribe(subscriber: SlowmoSubscriber): () => void;
}

const RUNTIME_KEY = Symbol.for('slowmo.runtime.v1');
const DEFAULT_OWNER = Symbol.for('slowmo.default-controller.v1');

function isSlowmoExcluded(element: Element): boolean {
  let current: Element | null = element;

  while (current) {
    if (current.closest?.('[data-slowmo-exclude]')) return true;
    const root = current.getRootNode?.();
    current =
      typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot
        ? root.host
        : null;
  }

  return false;
}

class BrowserSlowmoRuntime implements SharedRuntime {
  readonly version = 1 as const;

  private owners = new Map<symbol, number>();
  private subscribers = new Set<SlowmoSubscriber>();
  private natives: NativeTiming | null = null;
  private installed = false;
  private currentSpeed = 1;
  private previousPlayingSpeed = 1;
  private virtualTime = 0;
  private lastRealTime = 0;
  private virtualDateNow = 0;
  private lastRealDateNow = 0;
  private pollRequest: number | null = null;
  private trackedAnimations = new Map<Animation, TrackedPlayback>();
  private trackedMedia = new Map<HTMLMediaElement, TrackedPlayback>();
  private gsapOriginalTimeScale: number | null = null;

  acquire(owner: symbol): void {
    if (this.owners.has(owner)) return;
    this.owners.set(owner, this.currentSpeed);
    if (!this.installed) this.install();
    this.emit();
  }

  release(owner: symbol): void {
    if (!this.owners.delete(owner)) return;
    if (this.owners.size === 0) {
      this.uninstall();
      return;
    }
    const remainingSpeeds = [...this.owners.values()];
    this.applySpeed(remainingSpeeds[remainingSpeeds.length - 1] ?? 1);
  }

  hasOwner(owner: symbol): boolean {
    return this.owners.has(owner);
  }

  getSpeed(): number {
    return this.installed ? this.currentSpeed : 1;
  }

  getWallClock(): SlowmoWallClock {
    return {
      setTimeout: (callback, delay) => {
        if (typeof window === 'undefined') {
          return globalThis.setTimeout(callback, delay) as unknown as number;
        }
        const setTimeoutFunction = this.natives?.setTimeout ?? window.setTimeout;
        return Reflect.apply(setTimeoutFunction, window, [
          callback,
          delay,
        ]) as unknown as number;
      },
      clearTimeout: (handle) => {
        if (typeof window === 'undefined') {
          globalThis.clearTimeout(handle);
          return;
        }
        const clearTimeoutFunction =
          this.natives?.clearTimeout ?? window.clearTimeout;
        Reflect.apply(clearTimeoutFunction, window, [handle]);
      },
    };
  }

  subscribe(subscriber: SlowmoSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  setSpeed(owner: symbol, speed: number): void {
    if (!this.owners.has(owner)) return;
    this.owners.delete(owner);
    this.owners.set(owner, speed);
    this.applySpeed(speed);
  }

  private applySpeed(speed: number): void {
    if (!this.installed || !this.natives) return;
    if (Number.isNaN(speed) || speed < 0) {
      throw new RangeError('Slowmo speed must be a non-negative number.');
    }

    const realNow = this.natives.performanceNow.call(performance);
    this.virtualTime = this.getVirtualTime(realNow);
    this.lastRealTime = realNow;

    const realDateNow = this.natives.dateNow.call(Date);
    this.virtualDateNow = this.getVirtualDateNow(realDateNow);
    this.lastRealDateNow = realDateNow;

    this.currentSpeed = speed;
    if (speed > 0 && Number.isFinite(speed)) this.previousPlayingSpeed = speed;
    this.updateWebAnimations();
    this.updateMediaElements();
    this.updateGsap();
    this.emit();
  }

  private snapshot(): SlowmoSnapshot {
    return {
      status: this.installed ? 'active' : 'inactive',
      speed: this.installed ? this.currentSpeed : 1,
      paused: this.installed && this.currentSpeed === 0,
    };
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const subscriber of this.subscribers) subscriber(snapshot);
  }

  private effectiveSpeed(): number {
    return this.currentSpeed === Number.POSITIVE_INFINITY ? 1000 : this.currentSpeed;
  }

  private getVirtualTime(realTime: number): number {
    if (this.currentSpeed === 0) return this.virtualTime;
    return this.virtualTime + (realTime - this.lastRealTime) * this.effectiveSpeed();
  }

  private getVirtualDateNow(realDateNow: number): number {
    if (this.currentSpeed === 0) return this.virtualDateNow;
    return this.virtualDateNow
      + (realDateNow - this.lastRealDateNow) * this.effectiveSpeed();
  }

  private install(): void {
    if (this.installed || typeof window === 'undefined') return;

    const performanceNowDescriptor = Object.getOwnPropertyDescriptor(performance, 'now');
    this.natives = {
      requestAnimationFrame: window.requestAnimationFrame,
      cancelAnimationFrame: window.cancelAnimationFrame,
      performanceNow: performance.now,
      performanceNowDescriptor,
      dateNow: Date.now,
      setTimeout: window.setTimeout,
      clearTimeout: window.clearTimeout,
      setInterval: window.setInterval,
    };

    this.currentSpeed = 1;
    this.previousPlayingSpeed = 1;
    this.lastRealTime = this.natives.performanceNow.call(performance);
    this.virtualTime = this.lastRealTime;
    this.lastRealDateNow = this.natives.dateNow.call(Date);
    this.virtualDateNow = this.lastRealDateNow;

    const runtime = this;
    window.requestAnimationFrame = function slowmoRequestAnimationFrame(
      callback: FrameRequestCallback,
    ): number {
      const natives = runtime.natives;
      if (!natives) return 0;
      return natives.requestAnimationFrame.call(window, (realTimestamp) => {
        if (runtime.currentSpeed === 0) {
          window.requestAnimationFrame(callback);
          return;
        }
        callback(runtime.getVirtualTime(realTimestamp));
      });
    };

    Object.defineProperty(performance, 'now', {
      configurable: true,
      value: () => {
        const natives = runtime.natives;
        return natives
          ? runtime.getVirtualTime(natives.performanceNow.call(performance))
          : 0;
      },
    });

    Date.now = () => {
      const natives = runtime.natives;
      return natives
        ? runtime.getVirtualDateNow(natives.dateNow.call(Date))
        : 0;
    };

    window.setTimeout = ((
      callback: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ): number => {
      const natives = runtime.natives;
      if (!natives) return 0;
      const effectiveSpeed = runtime.currentSpeed || 0.0001;
      return Reflect.apply(natives.setTimeout, window, [
        callback,
        (delay ?? 0) / effectiveSpeed,
        ...args,
      ]) as unknown as number;
    }) as typeof window.setTimeout;

    window.setInterval = ((
      callback: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ): number => {
      const natives = runtime.natives;
      if (!natives) return 0;
      const effectiveSpeed = runtime.currentSpeed || 0.0001;
      return Reflect.apply(natives.setInterval, window, [
        callback,
        (delay ?? 0) / effectiveSpeed,
        ...args,
      ]) as unknown as number;
    }) as typeof window.setInterval;

    this.installed = true;
    this.poll();
  }

  private poll = (): void => {
    if (!this.installed || !this.natives) return;
    this.updateWebAnimations();
    this.updateMediaElements();
    this.pollRequest = this.natives.requestAnimationFrame.call(window, this.poll);
  };

  private updateWebAnimations(): void {
    if (
      typeof document === 'undefined'
      || typeof document.getAnimations !== 'function'
    ) {
      return;
    }

    for (const animation of document.getAnimations()) {
      const effect = animation.effect as KeyframeEffect | null;
      if (
        effect?.target instanceof Element
        && isSlowmoExcluded(effect.target)
      ) {
        continue;
      }

      let tracked = this.trackedAnimations.get(animation);
      if (!tracked) {
        tracked = {
          originalRate: animation.playbackRate,
          appliedRate: animation.playbackRate,
          pausedBySlowmo: false,
        };
        this.trackedAnimations.set(animation, tracked);
      } else if (
        this.currentSpeed !== 0
        && animation.playbackRate !== tracked.appliedRate
      ) {
        tracked.originalRate = animation.playbackRate;
      }

      if (this.currentSpeed === Number.POSITIVE_INFINITY) {
        try {
          animation.finish();
        } catch {
          animation.playbackRate = 16;
          tracked.appliedRate = 16;
        }
        continue;
      }

      const nextRate = tracked.originalRate * this.currentSpeed;
      if (animation.playbackRate !== nextRate) {
        animation.playbackRate = nextRate;
      }
      tracked.appliedRate = nextRate;

      if (this.currentSpeed === 0) {
        if (animation.playState === 'running') {
          tracked.pausedBySlowmo = true;
          animation.pause();
        }
      } else if (tracked.pausedBySlowmo && animation.playState === 'paused') {
        tracked.pausedBySlowmo = false;
        animation.play();
      }
    }
  }

  private updateMediaElements(): void {
    if (typeof document === 'undefined') return;

    for (const element of document.querySelectorAll('video, audio')) {
      if (isSlowmoExcluded(element)) continue;
      const media = element as HTMLMediaElement;
      let tracked = this.trackedMedia.get(media);

      if (!tracked) {
        tracked = {
          originalRate: media.playbackRate,
          appliedRate: media.playbackRate,
          pausedBySlowmo: false,
        };
        this.trackedMedia.set(media, tracked);
      } else if (
        this.currentSpeed !== 0
        && media.playbackRate !== tracked.appliedRate
      ) {
        tracked.originalRate = media.playbackRate;
      }

      if (this.currentSpeed === Number.POSITIVE_INFINITY) {
        if (Number.isFinite(media.duration) && media.duration > 0) {
          media.currentTime = media.duration;
          if (!media.paused) tracked.pausedBySlowmo = true;
          media.pause();
        }
        continue;
      }

      if (this.currentSpeed === 0) {
        if (!media.paused) {
          tracked.pausedBySlowmo = true;
          media.pause();
        }
        continue;
      }

      if (tracked.pausedBySlowmo) {
        tracked.pausedBySlowmo = false;
        void media.play().catch(() => undefined);
      }

      const nextRate = Math.min(
        16,
        Math.max(0.0625, tracked.originalRate * this.currentSpeed),
      );
      if (media.playbackRate !== nextRate) media.playbackRate = nextRate;
      tracked.appliedRate = nextRate;
    }
  }

  private updateGsap(): void {
    const gsap = (window as typeof window & {
      gsap?: { globalTimeline?: { timeScale(value?: number): number } };
    }).gsap;
    const timeline = gsap?.globalTimeline;
    if (!timeline?.timeScale) return;

    try {
      if (this.gsapOriginalTimeScale === null) {
        this.gsapOriginalTimeScale = timeline.timeScale();
      }
      timeline.timeScale(this.currentSpeed || 0.001);
    } catch {
      // GSAP may still be initializing.
    }
  }

  private restoreControlledObjects(): void {
    for (const [animation, tracked] of this.trackedAnimations) {
      try {
        animation.playbackRate = tracked.originalRate;
        if (tracked.pausedBySlowmo && animation.playState === 'paused') {
          animation.play();
        }
      } catch {
        // Detached or finished animations may no longer be mutable.
      }
    }

    for (const [media, tracked] of this.trackedMedia) {
      try {
        media.playbackRate = tracked.originalRate;
        if (tracked.pausedBySlowmo) void media.play().catch(() => undefined);
      } catch {
        // Detached media may no longer be mutable.
      }
    }

    if (this.gsapOriginalTimeScale !== null) {
      try {
        const gsap = (window as typeof window & {
          gsap?: { globalTimeline?: { timeScale(value?: number): number } };
        }).gsap;
        gsap?.globalTimeline?.timeScale(this.gsapOriginalTimeScale);
      } catch {
        // GSAP may have been removed after activation.
      }
    }
  }

  private uninstall(): void {
    if (!this.installed || !this.natives) {
      this.currentSpeed = 1;
      this.emit();
      return;
    }

    const natives = this.natives;
    this.restoreControlledObjects();

    if (this.pollRequest !== null) {
      natives.cancelAnimationFrame.call(window, this.pollRequest);
      this.pollRequest = null;
    }

    window.requestAnimationFrame = natives.requestAnimationFrame;
    if (natives.performanceNowDescriptor) {
      Object.defineProperty(performance, 'now', natives.performanceNowDescriptor);
    } else {
      Object.defineProperty(performance, 'now', {
        configurable: true,
        value: natives.performanceNow,
      });
    }
    Date.now = natives.dateNow;
    window.setTimeout = natives.setTimeout;
    window.setInterval = natives.setInterval;

    this.trackedAnimations.clear();
    this.trackedMedia.clear();
    this.gsapOriginalTimeScale = null;
    this.natives = null;
    this.installed = false;
    this.currentSpeed = 1;
    this.previousPlayingSpeed = 1;
    this.virtualTime = 0;
    this.lastRealTime = 0;
    this.virtualDateNow = 0;
    this.lastRealDateNow = 0;
    this.emit();
  }
}

function getSharedRuntime(): SharedRuntime {
  if (typeof window === 'undefined') {
    return new BrowserSlowmoRuntime();
  }

  const runtimeWindow = window as typeof window & {
    [key: symbol]: SharedRuntime | undefined;
  };
  const existing = runtimeWindow[RUNTIME_KEY];
  if (existing?.version === 1) return existing;

  const runtime = new BrowserSlowmoRuntime();
  runtimeWindow[RUNTIME_KEY] = runtime;
  return runtime;
}

function createController(owner = Symbol('slowmo-controller')): SlowmoController {
  const runtime = getSharedRuntime();
  const subscribers = new Set<SlowmoSubscriber>();
  let active = runtime.hasOwner(owner);
  let previousPlayingSpeed = 1;
  let unsubscribeRuntime: (() => void) | null = null;

  const getSnapshot = (): SlowmoSnapshot => ({
    status: active ? 'active' : 'inactive',
    speed: active ? runtime.getSpeed() : 1,
    paused: active && runtime.getSpeed() === 0,
  });

  const notify = (): void => {
    const snapshot = getSnapshot();
    for (const subscriber of subscribers) subscriber(snapshot);
  };

  const subscribeToRuntime = (): void => {
    unsubscribeRuntime ??= runtime.subscribe(() => {
      if (active) notify();
    });
  };
  if (active) subscribeToRuntime();

  const controller: SlowmoController = {
    activate() {
      if (active) return;
      active = true;
      subscribeToRuntime();
      runtime.acquire(owner);
    },

    setSpeed(speed) {
      controller.activate();
      if (speed > 0 && Number.isFinite(speed)) previousPlayingSpeed = speed;
      runtime.setSpeed(owner, speed);
    },

    pause() {
      if (controller.getSpeed() > 0 && Number.isFinite(controller.getSpeed())) {
        previousPlayingSpeed = controller.getSpeed();
      }
      controller.setSpeed(0);
    },

    play() {
      controller.setSpeed(previousPlayingSpeed || 1);
    },

    reset() {
      controller.setSpeed(1);
    },

    destroy() {
      if (!active) return;
      active = false;
      unsubscribeRuntime?.();
      unsubscribeRuntime = null;
      runtime.release(owner);
      previousPlayingSpeed = 1;
      notify();
    },

    getSpeed() {
      return getSnapshot().speed;
    },

    getSnapshot,

    subscribe(subscriber) {
      subscribers.add(subscriber);
      subscriber(getSnapshot());
      return () => subscribers.delete(subscriber);
    },
  };

  return controller;
}

export function createSlowmoController(): SlowmoController {
  return createController();
}

/**
 * Returns timers that continue on wall-clock time while Slowmo is active.
 * Useful for debug UI that must stay responsive at very low playback speeds.
 */
export function getSlowmoWallClock(): SlowmoWallClock {
  return getSharedRuntime().getWallClock();
}

const defaultController = createController(DEFAULT_OWNER);

export interface SlowmoFunction {
  (speed: number): void;
  activate(): void;
  setSpeed(speed: number): void;
  pause(): void;
  play(): void;
  reset(): void;
  destroy(): void;
  getSpeed(): number;
  getSnapshot(): SlowmoSnapshot;
  subscribe(subscriber: SlowmoSubscriber): () => void;
}

export const slowmo: SlowmoFunction = Object.assign(
  (speed: number) => defaultController.setSpeed(speed),
  {
    activate: () => defaultController.activate(),
    setSpeed: (speed: number) => defaultController.setSpeed(speed),
    pause: () => defaultController.pause(),
    play: () => defaultController.play(),
    reset: () => defaultController.reset(),
    destroy: () => defaultController.destroy(),
    getSpeed: () => defaultController.getSpeed(),
    getSnapshot: () => defaultController.getSnapshot(),
    subscribe: (subscriber: SlowmoSubscriber) => defaultController.subscribe(subscriber),
  },
);

export default slowmo;
