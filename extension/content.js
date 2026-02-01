/**
 * slowmo Chrome Extension - Content Script
 *
 * Injects the slowmo library and creates a floating, draggable controller.
 */

(function() {
  'use strict';

  // Avoid double injection
  if (window.__slowmoExtensionLoaded) return;
  window.__slowmoExtensionLoaded = true;

  // ============================================
  // SLOWMO LIBRARY (inlined for content script)
  // ============================================

  let currentSpeed = 1;
  let isPaused = false;
  let isInstalled = false;
  let originalRAF;
  let originalPerformanceNow;
  let virtualTime = 0;
  let lastRealTime = 0;
  let pauseTime = 0;

  const trackedAnimations = new WeakMap();
  const trackedMedia = new WeakMap();

  function getVirtualTime(realTime) {
    if (isPaused) return pauseTime;
    const elapsed = realTime - lastRealTime;
    // For infinity speed, jump time forward very quickly (1000x real time)
    const effectiveSpeed = currentSpeed === Infinity ? 1000 : currentSpeed;
    return virtualTime + elapsed * effectiveSpeed;
  }

  function updateWebAnimations() {
    if (typeof document.getAnimations !== 'function') return;
    const animations = document.getAnimations();
    for (const anim of animations) {
      const effect = anim.effect;
      if (effect?.target instanceof Element) {
        if (effect.target.closest('[data-slowmo-exclude]')) continue;
      }

      // Handle infinity speed - finish animations immediately
      if (currentSpeed === Infinity) {
        try {
          anim.finish();
        } catch {
          // Some animations can't be finished (infinite iterations)
          // Set to max browser-supported playback rate instead
          anim.playbackRate = 16;
        }
        continue;
      }

      const tracked = trackedAnimations.get(anim);
      if (!tracked) {
        const original = anim.playbackRate;
        const applied = original * currentSpeed;
        trackedAnimations.set(anim, { original, applied });
        anim.playbackRate = applied;
      } else {
        if (anim.playbackRate !== tracked.applied) {
          tracked.original = anim.playbackRate;
        }
        const newApplied = tracked.original * currentSpeed;
        if (anim.playbackRate !== newApplied) {
          anim.playbackRate = newApplied;
          tracked.applied = newApplied;
        }
      }
      if (isPaused) {
        if (anim.playState === 'running') anim.pause();
      } else {
        if (anim.playState === 'paused') anim.play();
      }
    }
  }

  function updateMediaElements() {
    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach((el) => {
      if (el.closest('[data-slowmo-exclude]')) return;
      const media = el;

      // Handle infinity speed - jump to end and pause
      if (currentSpeed === Infinity) {
        if (media.duration && isFinite(media.duration)) {
          media.currentTime = media.duration;
          media.pause();
        }
        return;
      }

      let tracked = trackedMedia.get(media);
      if (!tracked) {
        tracked = {
          original: media.playbackRate,
          applied: media.playbackRate * currentSpeed,
          wasPaused: false,
        };
        trackedMedia.set(media, tracked);
      } else {
        if (media.playbackRate !== tracked.applied && !isPaused) {
          tracked.original = media.playbackRate;
        }
      }
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
        // Clamp to browser limits (typically 0.0625 to 16)
        const newApplied = Math.min(16, Math.max(0.0625, tracked.original * currentSpeed));
        if (media.playbackRate !== newApplied) {
          media.playbackRate = newApplied;
          tracked.applied = newApplied;
        }
      }
    });
  }

  function pollAnimations() {
    updateWebAnimations();
    updateMediaElements();
    originalRAF(pollAnimations);
  }

  function install() {
    if (isInstalled || typeof window === 'undefined') return;
    originalRAF = window.requestAnimationFrame.bind(window);
    originalPerformanceNow = performance.now.bind(performance);
    lastRealTime = originalPerformanceNow();
    virtualTime = lastRealTime;

    const patchedRAF = (callback) => {
      return originalRAF((realTimestamp) => {
        const virtualTimestamp = getVirtualTime(realTimestamp);
        if (!isPaused) {
          callback(virtualTimestamp);
        } else {
          window.requestAnimationFrame(callback);
        }
      });
    };

    window.requestAnimationFrame = patchedRAF;
    if (typeof globalThis !== 'undefined') {
      globalThis.requestAnimationFrame = patchedRAF;
    }

    performance.now = () => getVirtualTime(originalPerformanceNow());
    originalRAF(pollAnimations);
    isInstalled = true;
  }

  function setSpeed(speed) {
    if (!isInstalled) install();
    const realNow = originalPerformanceNow();
    virtualTime = getVirtualTime(realNow);
    lastRealTime = realNow;
    currentSpeed = speed;
    isPaused = speed === 0;
    if (isPaused) {
      pauseTime = virtualTime;
    }
    updateWebAnimations();
    updateMediaElements();
    if (typeof window.gsap !== 'undefined') {
      try {
        window.gsap.globalTimeline.timeScale(speed || 0.001);
      } catch (e) {}
    }
  }

  // Initialize
  install();

  // ============================================
  // DIAL UI CONTROLLER
  // ============================================

  const DIAL_SIZE = 64;
  const DIAL_RADIUS = DIAL_SIZE / 2;

  // Interaction zone radii (from center)
  const PAUSE_ZONE_RADIUS = 14;
  const DRAG_ZONE_RADIUS = 24;

  // Speed range
  const MIN_SPEED = 1 / 60;
  const MAX_SPEED = 10;

  // Rotation range: symmetric visual limits, 1x at center (0°)
  // Both sides stop 22.5° from straight down
  const MIN_ANGLE = -157.5;  // At speed 1/60 (down-left)
  const MAX_ANGLE = 157.5;   // At speed 10 (down-right)

  // Snap to 1x within this range
  const SNAP_SPEED_MIN = 0.92;
  const SNAP_SPEED_MAX = 1.08;

  // Rotation sensitivity (degrees per pixel)
  const ROTATION_SENSITIVITY = 0.5;

  // localStorage key for position only (speed is NOT persisted)
  const POSITION_KEY = 'slowmo-dial-position';

  // Colors
  const COLOR_BG = '#2A2A2A';
  const COLOR_BRASS = '#797058';

  // Dial state - initialize to 1x speed
  let dialAngle = speedToAngle(1);
  let dialPaused = false;
  let dialDragging = false;
  let dialRotating = false;
  let dialDragOffset = { x: 0, y: 0 };

  function angleToSpeed(angle) {
    let speed;
    if (angle <= 0) {
      // Slow side: MIN_ANGLE (-157.5°) → 0° maps to MIN_SPEED → 1
      const t = (angle - MIN_ANGLE) / (0 - MIN_ANGLE);
      speed = MIN_SPEED * Math.pow(1 / MIN_SPEED, t);
    } else {
      // Fast side: 0° → MAX_ANGLE (157.5°) maps to 1 → MAX_SPEED
      const t = angle / MAX_ANGLE;
      speed = 1 * Math.pow(MAX_SPEED / 1, t);
    }
    if (speed >= SNAP_SPEED_MIN && speed <= SNAP_SPEED_MAX) return 1;
    return speed;
  }

  function speedToAngle(speed) {
    const clampedSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
    if (clampedSpeed <= 1) {
      // Slow side: MIN_SPEED → 1 maps to MIN_ANGLE → 0°
      const logMin = Math.log(MIN_SPEED);
      const logSpeed = Math.log(clampedSpeed);
      const t = (logSpeed - logMin) / (0 - logMin);
      return MIN_ANGLE + t * (0 - MIN_ANGLE);
    } else {
      // Fast side: 1 → MAX_SPEED maps to 0° → MAX_ANGLE
      const logMax = Math.log(MAX_SPEED);
      const logSpeed = Math.log(clampedSpeed);
      const t = logSpeed / logMax;
      return t * MAX_ANGLE;
    }
  }

  function formatDialSpeed(speed) {
    if (speed >= 10) return '10';
    if (speed >= 1) {
      const formatted = speed.toFixed(1);
      return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
    }
    if (speed >= 0.1) {
      return speed.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    }
    return speed.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  }

  function clampAngle(angle) {
    return Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, angle));
  }

  function distanceFromCenter(x, y, rect) {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
  }

  function loadDialPosition() {
    try {
      const saved = localStorage.getItem(POSITION_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { right: 20, bottom: 20 };
  }

  function saveDialPosition(pos) {
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
    } catch (e) {}
  }

  function createDialUI() {
    if (!document.body) {
      setTimeout(createDialUI, 50);
      return;
    }

    const position = loadDialPosition();

    // The notches SVG (from user's dial.svg design)
    // Plus a triangle indicator at the top that rotates with the dial
    const notchesSvg = `
      <line x1="32.2086" y1="1.48839" x2="32.2183" y2="3.20793" stroke="${COLOR_BRASS}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M32.2071 5.8945L29.7114 10.7167H34.8037L32.2071 5.8945Z" fill="${COLOR_BRASS}"/>
      <line x1="35.1457" y1="1.53165" x2="35.0337" y2="3.23857" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="38.3373" y1="2.02536" x2="37.9446" y2="3.83661" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="41.4182" y1="2.98466" x2="40.9018" y2="4.53688" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="44.4138" y1="4.10541" x2="43.6976" y2="5.65107" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="49.8958" y1="7.34214" x2="48.8547" y2="8.73655" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="52.1693" y1="9.22075" x2="51.1281" y2="10.6152" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="54.4068" y1="11.4165" x2="53.3657" y2="12.8109" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="56.6366" y1="14.0388" x2="55.1042" y2="15.1372" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="59.6595" y1="19.4885" x2="58.0867" y2="20.2749" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="60.7531" y1="22.4076" x2="59.0996" y2="23.0582" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="62.3239" y1="28.7194" x2="60.2687" y2="28.9295" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="61.7567" y1="25.5569" x2="59.8715" y2="25.9858" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="47.3047" y1="5.87473" x2="46.0292" y2="8.14475" stroke="${COLOR_BRASS}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="62.4479" y1="32.1953" x2="59.6913" y2="32.2216" stroke="${COLOR_BRASS}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="58.1844" y1="17.0517" x2="56.0159" y2="18.3254" stroke="${COLOR_BRASS}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.21059" y2="-0.5" transform="matrix(0.0654353 0.997857 0.997857 -0.0654353 29.6227 1)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.35334" y2="-0.5" transform="matrix(0.211897 0.977292 0.977292 -0.211897 26.3475 1.43076)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.13585" y2="-0.5" transform="matrix(0.315659 0.948873 0.948873 -0.315659 23.2006 2.35239)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.20355" y2="-0.5" transform="matrix(0.420454 0.907314 0.907314 -0.420454 20.1317 3.44153)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.24021" y2="-0.5" transform="matrix(0.598277 0.801289 0.801289 -0.598277 14.5078 6.64236)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.24021" y2="-0.5" transform="matrix(0.598277 0.801289 0.801289 -0.598277 12.2344 8.52097)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.24021" y2="-0.5" transform="matrix(0.598277 0.801289 0.801289 -0.598277 9.99683 10.7167)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.3854" y2="-0.5" transform="matrix(0.812788 0.58256 0.58256 -0.812788 7.55042 13.3411)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.25838" y2="-0.5" transform="matrix(0.894426 0.447216 0.447216 -0.894426 4.41907 18.8177)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.2768" y2="-0.5" transform="matrix(0.930561 0.366138 0.366138 -0.930561 3.26685 21.7593)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.56594" y2="-0.5" transform="matrix(0.994816 0.101692 0.101692 -0.994816 1.53162 28.1712)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.43331" y2="-0.5" transform="matrix(0.975087 0.221825 0.221825 -0.975087 2.16882 24.9585)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.75" y1="-0.75" x2="3.35382" y2="-0.75" transform="matrix(0.48985 0.871807 0.871807 -0.48985 17.2839 4.85349)" stroke="${COLOR_BRASS}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="0.75" y1="-0.75" x2="3.50666" y2="-0.75" transform="matrix(0.999954 0.00955318 0.00955318 -0.999954 0.772583 31.1166)" stroke="${COLOR_BRASS}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="0.75" y1="-0.75" x2="3.2649" y2="-0.75" transform="matrix(0.862266 0.506456 0.506456 -0.862266 5.85083 16.0252)" stroke="${COLOR_BRASS}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="0.75" y1="-0.75" x2="5.25" y2="-0.75" transform="matrix(0 -1 -1 0 31.5 62.7045)" stroke="${COLOR_BRASS}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.21059" y2="-0.5" transform="matrix(-0.0654353 -0.997857 -0.997857 0.0654353 34.6794 62.7045)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.35334" y2="-0.5" transform="matrix(-0.211897 -0.977292 -0.977292 0.211897 37.9546 62.2737)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.13585" y2="-0.5" transform="matrix(-0.315659 -0.948873 -0.948873 0.315659 41.1016 61.3521)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.20355" y2="-0.5" transform="matrix(-0.420454 -0.907314 -0.907314 0.420454 44.1704 60.2629)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.24021" y2="-0.5" transform="matrix(-0.598277 -0.801289 -0.801289 0.598277 49.7943 57.0621)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.24021" y2="-0.5" transform="matrix(-0.598277 -0.801289 -0.801289 0.598277 52.0677 55.1835)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.24021" y2="-0.5" transform="matrix(-0.598277 -0.801289 -0.801289 0.598277 54.3053 52.9878)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.3854" y2="-0.5" transform="matrix(-0.812788 -0.58256 -0.58256 0.812788 56.7517 50.3633)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.25838" y2="-0.5" transform="matrix(-0.894426 -0.447216 -0.447216 0.894426 59.8831 44.8868)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.2768" y2="-0.5" transform="matrix(-0.930561 -0.366138 -0.366138 0.930561 61.0353 41.9452)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.56594" y2="-0.5" transform="matrix(-0.994816 -0.101692 -0.101692 0.994816 62.7705 35.5333)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.5" y1="-0.5" x2="2.43331" y2="-0.5" transform="matrix(-0.975087 -0.221825 -0.221825 0.975087 62.1333 38.746)" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="0.75" y1="-0.75" x2="3.35382" y2="-0.75" transform="matrix(-0.48985 -0.871807 -0.871807 0.48985 47.0182 58.851)" stroke="${COLOR_BRASS}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="0.75" y1="-0.75" x2="3.2649" y2="-0.75" transform="matrix(-0.862266 -0.506456 -0.506456 0.862266 58.4513 47.6793)" stroke="${COLOR_BRASS}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="29.1565" y1="62.1728" x2="29.2684" y2="60.4659" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="25.9648" y1="61.6791" x2="26.3576" y2="59.8679" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="22.884" y1="60.7198" x2="23.4003" y2="59.1676" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="19.8883" y1="59.5991" x2="20.6045" y2="58.0534" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="14.4063" y1="56.3623" x2="15.4474" y2="54.9679" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="12.1329" y1="54.4837" x2="13.174" y2="53.0893" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="9.89532" y1="52.288" x2="10.9364" y2="50.8936" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="7.66553" y1="49.6657" x2="9.19796" y2="48.5673" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="4.64267" y1="44.216" x2="6.21541" y2="43.4296" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="3.54906" y1="41.2968" x2="5.20248" y2="40.6463" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="1.97818" y1="34.985" x2="4.03341" y2="34.775" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="2.54545" y1="38.1476" x2="4.4306" y2="37.7187" stroke="${COLOR_BRASS}" stroke-linecap="round"/>
      <line x1="16.9975" y1="57.8297" x2="18.2729" y2="55.5597" stroke="${COLOR_BRASS}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="6.11769" y1="46.6528" x2="8.2862" y2="45.3791" stroke="${COLOR_BRASS}" stroke-width="1.5" stroke-linecap="round"/>
    `;

    const root = document.createElement('div');
    root.id = 'slowmo-ext-root';
    root.style.cssText = `
      position: fixed;
      right: ${position.right}px;
      bottom: ${position.bottom}px;
      width: ${DIAL_SIZE}px;
      height: ${DIAL_SIZE}px;
      z-index: 2147483647;
      user-select: none;
      font-family: ui-monospace, 'SF Mono', Monaco, monospace;
    `;

    root.innerHTML = `
      <svg viewBox="0 0 ${DIAL_SIZE} ${DIAL_SIZE}" style="width:100%;height:100%;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.5));">
        <!-- Background circle -->
        <circle cx="${DIAL_RADIUS}" cy="${DIAL_RADIUS}" r="${DIAL_RADIUS}" fill="${COLOR_BG}"/>

        <!-- Rotating notches group (includes triangle indicator) -->
        <g class="dial-notch" transform="rotate(${dialAngle}, ${DIAL_RADIUS}, ${DIAL_RADIUS})">
          ${notchesSvg}
        </g>

        <!-- Pause/Play icon in center -->
        <g class="dial-pause-icon" transform="translate(${DIAL_RADIUS}, ${DIAL_RADIUS})">
          ${dialPaused
            ? `<path d="M-4.5 -8.5L7.5 0L-4.5 8.5Z" fill="${COLOR_BRASS}" stroke="${COLOR_BRASS}" stroke-width="1.5" stroke-linejoin="round"/>`
            : `<line x1="-4.5" y1="-8" x2="-4.5" y2="8" stroke="${COLOR_BRASS}" stroke-width="3" stroke-linecap="round"/>
               <line x1="5.5" y1="-8" x2="5.5" y2="8" stroke="${COLOR_BRASS}" stroke-width="3" stroke-linecap="round"/>`
          }
        </g>
      </svg>
      <div class="dial-speed" style="
        position: absolute;
        bottom: -18px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 11px;
        font-weight: 600;
        color: ${COLOR_BRASS};
        pointer-events: none;
        white-space: nowrap;
      ">${dialPaused ? 'paused' : formatDialSpeed(angleToSpeed(dialAngle)) + 'x'}</div>
    `;

    document.body.appendChild(root);

    const notch = root.querySelector('.dial-notch');
    const pauseIcon = root.querySelector('.dial-pause-icon');
    const speedDisplay = root.querySelector('.dial-speed');

    function updateNotch() {
      notch.setAttribute('transform', `rotate(${dialAngle}, ${DIAL_RADIUS}, ${DIAL_RADIUS})`);
    }

    function updatePauseIcon() {
      pauseIcon.innerHTML = dialPaused
        ? `<path d="M-4.5 -8.5L7.5 0L-4.5 8.5Z" fill="${COLOR_BRASS}" stroke="${COLOR_BRASS}" stroke-width="1.5" stroke-linejoin="round"/>`
        : `<line x1="-4.5" y1="-8" x2="-4.5" y2="8" stroke="${COLOR_BRASS}" stroke-width="3" stroke-linecap="round"/>
           <line x1="5.5" y1="-8" x2="5.5" y2="8" stroke="${COLOR_BRASS}" stroke-width="3" stroke-linecap="round"/>`;
    }

    function updateSpeedDisplay() {
      speedDisplay.textContent = dialPaused ? 'paused' : formatDialSpeed(angleToSpeed(dialAngle)) + 'x';
    }

    function handleMouseDown(e) {
      e.preventDefault();
      const rect = root.getBoundingClientRect();
      const dist = distanceFromCenter(e.clientX, e.clientY, rect);

      if (dist < PAUSE_ZONE_RADIUS) {
        // Pause toggle
        dialPaused = !dialPaused;
        updatePauseIcon();
        updateSpeedDisplay();
        setSpeed(dialPaused ? 0 : angleToSpeed(dialAngle));
      } else if (dist < DRAG_ZONE_RADIUS) {
        // Drag to reposition
        dialDragging = true;
        dialDragOffset.x = e.clientX - rect.left;
        dialDragOffset.y = e.clientY - rect.top;
        root.style.cursor = 'grabbing';
      } else {
        // Rotation
        dialRotating = true;
        root.requestPointerLock();
      }
    }

    function handleMouseMove(e) {
      if (dialDragging) {
        const x = e.clientX - dialDragOffset.x;
        const y = e.clientY - dialDragOffset.y;
        const right = window.innerWidth - x - DIAL_SIZE;
        const bottom = window.innerHeight - y - DIAL_SIZE;
        root.style.right = Math.max(0, Math.min(right, window.innerWidth - DIAL_SIZE)) + 'px';
        root.style.bottom = Math.max(0, Math.min(bottom, window.innerHeight - DIAL_SIZE)) + 'px';
      } else if (dialRotating && document.pointerLockElement === root) {
        dialAngle = clampAngle(dialAngle + e.movementX * ROTATION_SENSITIVITY);
        updateNotch();
        updateSpeedDisplay();
        if (!dialPaused) {
          setSpeed(angleToSpeed(dialAngle));
        }
      }
    }

    function handleMouseUp() {
      if (dialDragging) {
        dialDragging = false;
        root.style.cursor = '';
        saveDialPosition({
          right: parseInt(root.style.right),
          bottom: parseInt(root.style.bottom)
        });
      }
      if (dialRotating) {
        dialRotating = false;
        document.exitPointerLock();
      }
    }

    function handlePointerLockChange() {
      if (document.pointerLockElement !== root && dialRotating) {
        dialRotating = false;
      }
    }

    root.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    // Apply initial speed
    if (!dialPaused) {
      setSpeed(angleToSpeed(dialAngle));
    }

    return root;
  }

  // ============================================
  // CROSS-FRAME COMMUNICATION
  // ============================================

  const isTopFrame = window === window.top;
  const MESSAGE_TYPE = 'slowmo-extension-sync';

  // Broadcast speed change to all iframes
  function broadcastToFrames(speed, paused) {
    const message = { type: MESSAGE_TYPE, speed, paused };

    // Send to all child iframes
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        iframe.contentWindow?.postMessage(message, '*');
      } catch (e) {
        // Cross-origin iframe, message will still be received if our script is injected
      }
    });
  }

  // Listen for messages from parent (if we're in an iframe)
  window.addEventListener('message', (event) => {
    if (event.data?.type === MESSAGE_TYPE) {
      const { speed, paused } = event.data;
      setSpeed(paused ? 0 : speed);

      // Also forward to nested iframes
      broadcastToFrames(speed, paused);
    }
  });

  // Watch for new iframes being added to the DOM (top frame only)
  function watchForNewIframes() {
    if (!isTopFrame) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === 'IFRAME') {
            // New iframe added, send current state after it loads
            node.addEventListener('load', () => {
              try {
                node.contentWindow?.postMessage({
                  type: MESSAGE_TYPE,
                  speed: angleToSpeed(dialAngle),
                  paused: dialPaused
                }, '*');
              } catch (e) {}
            });
          }
          // Also check children of added nodes
          if (node.querySelectorAll) {
            node.querySelectorAll('iframe').forEach(iframe => {
              iframe.addEventListener('load', () => {
                try {
                  iframe.contentWindow?.postMessage({
                    type: MESSAGE_TYPE,
                    speed: angleToSpeed(dialAngle),
                    paused: dialPaused
                  }, '*');
                } catch (e) {}
              });
            });
          }
        });
      });
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // Wrap setSpeed to also broadcast changes (top frame only)
  const originalSetSpeed = setSpeed;
  if (isTopFrame) {
    setSpeed = function(speed) {
      originalSetSpeed(speed);
      broadcastToFrames(speed, speed === 0);
    };
  }

  // ============================================
  // EXPOSE GLOBAL API
  // ============================================

  // Expose slowmo function globally for programmatic control
  // This allows pages and tests to call window.slowmo(0.5)
  window.slowmo = function(speed) {
    if (isTopFrame) {
      uiSpeed = speed;
      uiPaused = speed === 0;
      setSpeed(speed);
      saveState();
      updateUI();
    } else {
      setSpeed(speed);
    }
  };

  // Also expose helper methods
  window.slowmo.getSpeed = function() {
    return isTopFrame ? uiSpeed : currentSpeed;
  };

  window.slowmo.pause = function() {
    window.slowmo(0);
  };

  window.slowmo.play = function() {
    if (isTopFrame) {
      uiPaused = false;
      setSpeed(uiSpeed || 1);
      saveState();
      updateUI();
    } else {
      setSpeed(currentSpeed || 1);
    }
  };

  // ============================================
  // INITIALIZE
  // ============================================

  if (isTopFrame) {
    // Top frame: create dial UI, watch for iframes
    createDialUI();
    watchForNewIframes();

    // Sync existing iframes on load
    setTimeout(() => {
      broadcastToFrames(angleToSpeed(dialAngle), dialPaused);
    }, 100);
  } else {
    // Iframe: just install slowmo, no UI
    // Speed will be synced via postMessage from parent
  }

})();
