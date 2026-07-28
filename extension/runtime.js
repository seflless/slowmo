(function() {
  "use strict";
  var _a, _b;
  const RUNTIME_KEY = Symbol.for("slowmo.runtime.v1");
  const DEFAULT_OWNER = Symbol.for("slowmo.default-controller.v1");
  function isSlowmoExcluded(element) {
    var _a2, _b2;
    let current = element;
    while (current) {
      if ((_a2 = current.closest) == null ? void 0 : _a2.call(current, "[data-slowmo-exclude]")) return true;
      const root = (_b2 = current.getRootNode) == null ? void 0 : _b2.call(current);
      current = typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot ? root.host : null;
    }
    return false;
  }
  class BrowserSlowmoRuntime {
    constructor() {
      this.version = 1;
      this.owners = /* @__PURE__ */ new Map();
      this.subscribers = /* @__PURE__ */ new Set();
      this.natives = null;
      this.installed = false;
      this.currentSpeed = 1;
      this.previousPlayingSpeed = 1;
      this.virtualTime = 0;
      this.lastRealTime = 0;
      this.virtualDateNow = 0;
      this.lastRealDateNow = 0;
      this.pollRequest = null;
      this.trackedAnimations = /* @__PURE__ */ new Map();
      this.trackedMedia = /* @__PURE__ */ new Map();
      this.gsapOriginalTimeScale = null;
      this.poll = () => {
        if (!this.installed || !this.natives) return;
        this.updateWebAnimations();
        this.updateMediaElements();
        this.pollRequest = this.natives.requestAnimationFrame.call(window, this.poll);
      };
    }
    acquire(owner) {
      if (this.owners.has(owner)) return;
      this.owners.set(owner, this.currentSpeed);
      if (!this.installed) this.install();
      this.emit();
    }
    release(owner) {
      if (!this.owners.delete(owner)) return;
      if (this.owners.size === 0) {
        this.uninstall();
        return;
      }
      const remainingSpeeds = [...this.owners.values()];
      this.applySpeed(remainingSpeeds[remainingSpeeds.length - 1] ?? 1);
    }
    hasOwner(owner) {
      return this.owners.has(owner);
    }
    getSpeed() {
      return this.installed ? this.currentSpeed : 1;
    }
    getWallClock() {
      return {
        setTimeout: (callback, delay) => {
          var _a2;
          if (typeof window === "undefined") {
            return globalThis.setTimeout(callback, delay);
          }
          const setTimeoutFunction = ((_a2 = this.natives) == null ? void 0 : _a2.setTimeout) ?? window.setTimeout;
          return Reflect.apply(setTimeoutFunction, window, [
            callback,
            delay
          ]);
        },
        clearTimeout: (handle) => {
          var _a2;
          if (typeof window === "undefined") {
            globalThis.clearTimeout(handle);
            return;
          }
          const clearTimeoutFunction = ((_a2 = this.natives) == null ? void 0 : _a2.clearTimeout) ?? window.clearTimeout;
          Reflect.apply(clearTimeoutFunction, window, [handle]);
        }
      };
    }
    subscribe(subscriber) {
      this.subscribers.add(subscriber);
      return () => this.subscribers.delete(subscriber);
    }
    setSpeed(owner, speed) {
      if (!this.owners.has(owner)) return;
      this.owners.delete(owner);
      this.owners.set(owner, speed);
      this.applySpeed(speed);
    }
    applySpeed(speed) {
      if (!this.installed || !this.natives) return;
      if (Number.isNaN(speed) || speed < 0) {
        throw new RangeError("Slowmo speed must be a non-negative number.");
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
    snapshot() {
      return {
        status: this.installed ? "active" : "inactive",
        speed: this.installed ? this.currentSpeed : 1,
        paused: this.installed && this.currentSpeed === 0
      };
    }
    emit() {
      const snapshot = this.snapshot();
      for (const subscriber of this.subscribers) subscriber(snapshot);
    }
    effectiveSpeed() {
      return this.currentSpeed === Number.POSITIVE_INFINITY ? 1e3 : this.currentSpeed;
    }
    getVirtualTime(realTime) {
      if (this.currentSpeed === 0) return this.virtualTime;
      return this.virtualTime + (realTime - this.lastRealTime) * this.effectiveSpeed();
    }
    getVirtualDateNow(realDateNow) {
      if (this.currentSpeed === 0) return this.virtualDateNow;
      return this.virtualDateNow + (realDateNow - this.lastRealDateNow) * this.effectiveSpeed();
    }
    install() {
      if (this.installed || typeof window === "undefined") return;
      const performanceNowDescriptor = Object.getOwnPropertyDescriptor(performance, "now");
      this.natives = {
        requestAnimationFrame: window.requestAnimationFrame,
        cancelAnimationFrame: window.cancelAnimationFrame,
        performanceNow: performance.now,
        performanceNowDescriptor,
        dateNow: Date.now,
        setTimeout: window.setTimeout,
        clearTimeout: window.clearTimeout,
        setInterval: window.setInterval
      };
      this.currentSpeed = 1;
      this.previousPlayingSpeed = 1;
      this.lastRealTime = this.natives.performanceNow.call(performance);
      this.virtualTime = this.lastRealTime;
      this.lastRealDateNow = this.natives.dateNow.call(Date);
      this.virtualDateNow = this.lastRealDateNow;
      const runtime = this;
      window.requestAnimationFrame = function slowmoRequestAnimationFrame(callback) {
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
      Object.defineProperty(performance, "now", {
        configurable: true,
        value: () => {
          const natives = runtime.natives;
          return natives ? runtime.getVirtualTime(natives.performanceNow.call(performance)) : 0;
        }
      });
      Date.now = () => {
        const natives = runtime.natives;
        return natives ? runtime.getVirtualDateNow(natives.dateNow.call(Date)) : 0;
      };
      window.setTimeout = (callback, delay, ...args) => {
        const natives = runtime.natives;
        if (!natives) return 0;
        const effectiveSpeed = runtime.currentSpeed || 1e-4;
        return Reflect.apply(natives.setTimeout, window, [
          callback,
          (delay ?? 0) / effectiveSpeed,
          ...args
        ]);
      };
      window.setInterval = (callback, delay, ...args) => {
        const natives = runtime.natives;
        if (!natives) return 0;
        const effectiveSpeed = runtime.currentSpeed || 1e-4;
        return Reflect.apply(natives.setInterval, window, [
          callback,
          (delay ?? 0) / effectiveSpeed,
          ...args
        ]);
      };
      this.installed = true;
      this.poll();
    }
    updateWebAnimations() {
      if (typeof document === "undefined" || typeof document.getAnimations !== "function") {
        return;
      }
      for (const animation of document.getAnimations()) {
        const effect = animation.effect;
        if ((effect == null ? void 0 : effect.target) instanceof Element && isSlowmoExcluded(effect.target)) {
          continue;
        }
        let tracked = this.trackedAnimations.get(animation);
        if (!tracked) {
          tracked = {
            originalRate: animation.playbackRate,
            appliedRate: animation.playbackRate,
            pausedBySlowmo: false
          };
          this.trackedAnimations.set(animation, tracked);
        } else if (this.currentSpeed !== 0 && animation.playbackRate !== tracked.appliedRate) {
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
          if (animation.playState === "running") {
            tracked.pausedBySlowmo = true;
            animation.pause();
          }
        } else if (tracked.pausedBySlowmo && animation.playState === "paused") {
          tracked.pausedBySlowmo = false;
          animation.play();
        }
      }
    }
    updateMediaElements() {
      if (typeof document === "undefined") return;
      for (const element of document.querySelectorAll("video, audio")) {
        if (isSlowmoExcluded(element)) continue;
        const media = element;
        let tracked = this.trackedMedia.get(media);
        if (!tracked) {
          tracked = {
            originalRate: media.playbackRate,
            appliedRate: media.playbackRate,
            pausedBySlowmo: false
          };
          this.trackedMedia.set(media, tracked);
        } else if (this.currentSpeed !== 0 && media.playbackRate !== tracked.appliedRate) {
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
          void media.play().catch(() => void 0);
        }
        const nextRate = Math.min(
          16,
          Math.max(0.0625, tracked.originalRate * this.currentSpeed)
        );
        if (media.playbackRate !== nextRate) media.playbackRate = nextRate;
        tracked.appliedRate = nextRate;
      }
    }
    updateGsap() {
      const gsap = window.gsap;
      const timeline = gsap == null ? void 0 : gsap.globalTimeline;
      if (!(timeline == null ? void 0 : timeline.timeScale)) return;
      try {
        if (this.gsapOriginalTimeScale === null) {
          this.gsapOriginalTimeScale = timeline.timeScale();
        }
        timeline.timeScale(this.currentSpeed || 1e-3);
      } catch {
      }
    }
    restoreControlledObjects() {
      var _a2;
      for (const [animation, tracked] of this.trackedAnimations) {
        try {
          animation.playbackRate = tracked.originalRate;
          if (tracked.pausedBySlowmo && animation.playState === "paused") {
            animation.play();
          }
        } catch {
        }
      }
      for (const [media, tracked] of this.trackedMedia) {
        try {
          media.playbackRate = tracked.originalRate;
          if (tracked.pausedBySlowmo) void media.play().catch(() => void 0);
        } catch {
        }
      }
      if (this.gsapOriginalTimeScale !== null) {
        try {
          const gsap = window.gsap;
          (_a2 = gsap == null ? void 0 : gsap.globalTimeline) == null ? void 0 : _a2.timeScale(this.gsapOriginalTimeScale);
        } catch {
        }
      }
    }
    uninstall() {
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
        Object.defineProperty(performance, "now", natives.performanceNowDescriptor);
      } else {
        Object.defineProperty(performance, "now", {
          configurable: true,
          value: natives.performanceNow
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
  function getSharedRuntime() {
    if (typeof window === "undefined") {
      return new BrowserSlowmoRuntime();
    }
    const runtimeWindow = window;
    const existing = runtimeWindow[RUNTIME_KEY];
    if ((existing == null ? void 0 : existing.version) === 1) return existing;
    const runtime = new BrowserSlowmoRuntime();
    runtimeWindow[RUNTIME_KEY] = runtime;
    return runtime;
  }
  function createController(owner = Symbol("slowmo-controller")) {
    const runtime = getSharedRuntime();
    const subscribers = /* @__PURE__ */ new Set();
    let active = runtime.hasOwner(owner);
    let previousPlayingSpeed = 1;
    let unsubscribeRuntime = null;
    const getSnapshot = () => ({
      status: active ? "active" : "inactive",
      speed: active ? runtime.getSpeed() : 1,
      paused: active && runtime.getSpeed() === 0
    });
    const notify = () => {
      const snapshot = getSnapshot();
      for (const subscriber of subscribers) subscriber(snapshot);
    };
    const subscribeToRuntime = () => {
      unsubscribeRuntime ?? (unsubscribeRuntime = runtime.subscribe(() => {
        if (active) notify();
      }));
    };
    if (active) subscribeToRuntime();
    const controller = {
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
        unsubscribeRuntime == null ? void 0 : unsubscribeRuntime();
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
      }
    };
    return controller;
  }
  function createSlowmoController() {
    return createController();
  }
  const defaultController = createController(DEFAULT_OWNER);
  Object.assign(
    (speed) => defaultController.setSpeed(speed),
    {
      activate: () => defaultController.activate(),
      setSpeed: (speed) => defaultController.setSpeed(speed),
      pause: () => defaultController.pause(),
      play: () => defaultController.play(),
      reset: () => defaultController.reset(),
      destroy: () => defaultController.destroy(),
      getSpeed: () => defaultController.getSpeed(),
      getSnapshot: () => defaultController.getSnapshot(),
      subscribe: (subscriber) => defaultController.subscribe(subscriber)
    }
  );
  const COMMAND_EVENT = "slowmo-extension-command-v1";
  const FRAME_MESSAGE = "slowmo-extension-frame-v1";
  const READY_MESSAGE = "slowmo-extension-ready-v1";
  const isTopFrame = window === window.top;
  function sendToChildren(command) {
    const message = { type: FRAME_MESSAGE, command };
    for (let index = 0; index < window.frames.length; index += 1) {
      window.frames[index].postMessage(message, "*");
    }
  }
  function createRuntime(sessionToken2) {
    const controller = createSlowmoController();
    let currentSpeed = 1;
    let deactivated = false;
    function apply(command, broadcast = true) {
      if (deactivated) return;
      if (command.command === "set-speed") {
        currentSpeed = command.speed;
        controller.setSpeed(command.speed);
        if (broadcast) sendToChildren(command);
        return;
      }
      if (broadcast) sendToChildren(command);
      deactivated = true;
      controller.destroy();
      document.removeEventListener(COMMAND_EVENT, handleToolbarCommand);
      window.removeEventListener("message", handleFrameMessage);
      delete window.__slowmoExtensionRuntimeV1;
    }
    function handleToolbarCommand(event) {
      if (!isTopFrame || !(event instanceof CustomEvent)) return;
      const detail = event.detail;
      if (!detail || typeof detail !== "object") return;
      if (detail.command === "deactivate") apply(detail);
      if (detail.command === "set-speed" && typeof detail.speed === "number" && detail.speed >= 0) {
        apply(detail);
      }
    }
    function handleFrameMessage(event) {
      const message = event.data;
      if (!message || typeof message !== "object") return;
      if (message.type === FRAME_MESSAGE && !isTopFrame && "command" in message) {
        const command = message.command;
        if (command.command === "deactivate" || command.command === "set-speed" && typeof command.speed === "number" && command.speed >= 0) {
          apply(command, true);
        }
        return;
      }
      if (message.type === READY_MESSAGE && event.source) {
        event.source.postMessage({
          type: FRAME_MESSAGE,
          command: { command: "set-speed", speed: currentSpeed }
        }, { targetOrigin: "*" });
      }
    }
    document.addEventListener(COMMAND_EVENT, handleToolbarCommand);
    window.addEventListener("message", handleFrameMessage);
    controller.reset();
    if (!isTopFrame) {
      window.parent.postMessage({ type: READY_MESSAGE }, "*");
    }
    return {
      controller,
      sessionToken: sessionToken2,
      setSpeed(speed) {
        apply({ command: "set-speed", speed });
      },
      deactivate() {
        apply({ command: "deactivate" });
      }
    };
  }
  const sessionToken = window.__slowmoExtensionSessionTokenV1;
  if (!sessionToken) {
    (_a = window.__slowmoExtensionRuntimeV1) == null ? void 0 : _a.deactivate();
  } else if (window.__slowmoExtensionRuntimeV1 && window.__slowmoExtensionRuntimeV1.sessionToken === sessionToken) {
    window.__slowmoExtensionRuntimeV1.setSpeed(1);
  } else {
    (_b = window.__slowmoExtensionRuntimeV1) == null ? void 0 : _b.deactivate();
    window.__slowmoExtensionRuntimeV1 = createRuntime(sessionToken);
  }
})();
