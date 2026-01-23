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
    return virtualTime + elapsed * currentSpeed;
  }

  function updateWebAnimations() {
    if (typeof document.getAnimations !== 'function') return;
    const animations = document.getAnimations();
    for (const anim of animations) {
      const effect = anim.effect;
      if (effect?.target instanceof Element) {
        if (effect.target.closest('[data-slowmo-exclude]')) continue;
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
        const newApplied = tracked.original * currentSpeed;
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

  /**
   * Skip all animations - instantly complete them
   */
  function skipAnimations() {
    if (!isInstalled) install();

    // Finish all Web Animations
    if (typeof document.getAnimations === 'function') {
      const animations = document.getAnimations();
      for (const anim of animations) {
        const effect = anim.effect;
        if (effect?.target instanceof Element) {
          if (effect.target.closest('[data-slowmo-exclude]')) continue;
        }
        try {
          anim.finish();
        } catch (e) {
          // Some animations can't be finished (infinite, etc)
          try {
            anim.cancel();
          } catch (e2) {}
        }
      }
    }

    // Seek all media to end
    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach((el) => {
      if (el.closest('[data-slowmo-exclude]')) return;
      const media = el;
      if (media.duration && isFinite(media.duration)) {
        media.currentTime = media.duration;
      }
    });

    // Jump virtual time forward significantly for rAF-based animations
    virtualTime += 100000; // Jump 100 seconds forward
  }

  // Initialize
  install();

  // ============================================
  // UI CONTROLLER
  // ============================================

  const STORAGE_KEY = 'slowmo-controller-state';
  const POSITION_KEY = 'slowmo-controller-position';

  // State
  let uiSpeed = 1;
  let uiPaused = false;
  let isExpanded = false;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  // Load saved state
  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        uiSpeed = state.speed ?? 1;
        uiPaused = state.paused ?? false;
        isExpanded = state.expanded ?? false;
        setSpeed(uiPaused ? 0 : uiSpeed);
      }
    } catch (e) {}
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        speed: uiSpeed,
        paused: uiPaused,
        expanded: isExpanded
      }));
    } catch (e) {}
  }

  function loadPosition() {
    try {
      const saved = localStorage.getItem(POSITION_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { right: 20, bottom: 20 };
  }

  function savePosition(pos) {
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
    } catch (e) {}
  }

  // Create UI
  function createUI() {
    // Wait for body to exist
    if (!document.body) {
      setTimeout(createUI, 50);
      return;
    }

    const position = loadPosition();

    // Styles
    const styles = document.createElement('style');
    styles.textContent = `
      #slowmo-ext-root {
        --bg: #1c1917;
        --bg-hover: #292524;
        --border: #292524;
        --text: #fafaf9;
        --text-muted: #a8a29e;
        --text-dim: #57534e;
        --accent: #f59e0b;
        --accent-glow: rgba(245, 158, 11, 0.15);
        position: fixed;
        right: ${position.right}px;
        bottom: ${position.bottom}px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        -webkit-font-smoothing: antialiased;
      }

      #slowmo-ext-root * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .slowmo-ext-container {
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 24px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.03);
        overflow: hidden;
        user-select: none;
        transition: border-radius 0.2s;
      }

      .slowmo-ext-container.expanded {
        border-radius: 12px;
      }

      /* Collapsed state - just the clock icon */
      .slowmo-ext-collapsed {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        cursor: grab;
        position: relative;
        transition: background 0.15s;
      }

      .slowmo-ext-collapsed:hover {
        background: var(--bg-hover);
      }

      .slowmo-ext-collapsed:active {
        cursor: grabbing;
      }

      .slowmo-ext-collapsed svg {
        width: 24px;
        height: 24px;
        color: var(--accent);
      }

      .slowmo-ext-badge {
        position: absolute;
        top: 4px;
        right: 4px;
        font-size: 9px;
        font-weight: 600;
        color: var(--text-muted);
        background: var(--bg-hover);
        padding: 2px 4px;
        border-radius: 4px;
      }

      /* Expanded state */
      .slowmo-ext-expanded {
        display: none;
        padding: 12px;
      }

      .slowmo-ext-container.expanded .slowmo-ext-collapsed {
        display: none;
      }

      .slowmo-ext-container.expanded .slowmo-ext-expanded {
        display: block;
      }

      .slowmo-ext-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        cursor: grab;
        padding: 0 2px;
      }

      .slowmo-ext-header:active {
        cursor: grabbing;
      }

      .slowmo-ext-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .slowmo-ext-title svg {
        width: 16px;
        height: 16px;
        color: var(--accent);
      }

      .slowmo-ext-close {
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        color: var(--text-dim);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, color 0.15s;
      }

      .slowmo-ext-close:hover {
        background: var(--bg-hover);
        color: var(--text);
      }

      .slowmo-ext-close svg {
        width: 14px;
        height: 14px;
      }

      /* Main controls row: [slow presets] [play/pause] [fast presets + skip] */
      .slowmo-ext-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 100px;
        padding: 6px 10px;
      }

      .slowmo-ext-presets {
        display: flex;
        gap: 4px;
      }

      .slowmo-ext-preset {
        padding: 6px 12px;
        border: none;
        background: transparent;
        border-radius: 100px;
        cursor: pointer;
        font-family: ui-monospace, 'SF Mono', Monaco, monospace;
        font-size: 12px;
        color: var(--text-dim);
        transition: all 0.15s;
        white-space: nowrap;
      }

      .slowmo-ext-preset:hover {
        background: var(--bg-hover);
        color: var(--text-muted);
      }

      .slowmo-ext-preset.active {
        background: var(--accent-glow);
        color: var(--accent);
      }

      .slowmo-ext-preset.skip {
        font-family: inherit;
        font-size: 14px;
        padding: 6px 8px;
      }

      /* Play/Pause button in the middle */
      .slowmo-ext-playpause {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border: none;
        background: var(--accent);
        border-radius: 50%;
        cursor: pointer;
        color: #000;
        transition: all 0.15s;
        margin: 0 8px;
        flex-shrink: 0;
      }

      .slowmo-ext-playpause:hover {
        transform: scale(1.05);
        box-shadow: 0 0 12px var(--accent-glow);
      }

      .slowmo-ext-playpause svg {
        width: 16px;
        height: 16px;
      }

      .slowmo-ext-divider {
        width: 1px;
        height: 20px;
        background: var(--border);
        margin: 0 4px;
      }
    `;
    document.head.appendChild(styles);

    // Container
    const root = document.createElement('div');
    root.id = 'slowmo-ext-root';
    root.innerHTML = `
      <div class="slowmo-ext-container ${isExpanded ? 'expanded' : ''}">
        <div class="slowmo-ext-collapsed">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span class="slowmo-ext-badge">${formatSpeed(uiSpeed)}</span>
        </div>
        <div class="slowmo-ext-expanded">
          <div class="slowmo-ext-header">
            <span class="slowmo-ext-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              slowmo
            </span>
            <button class="slowmo-ext-close" title="Collapse">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="slowmo-ext-controls">
            <div class="slowmo-ext-presets slowmo-ext-slow">
              <button class="slowmo-ext-preset ${uiSpeed === 0.1 && !uiPaused ? 'active' : ''}" data-speed="0.1">.1x</button>
              <button class="slowmo-ext-preset ${uiSpeed === 0.25 && !uiPaused ? 'active' : ''}" data-speed="0.25">.25x</button>
              <button class="slowmo-ext-preset ${uiSpeed === 0.5 && !uiPaused ? 'active' : ''}" data-speed="0.5">.5x</button>
            </div>
            <button class="slowmo-ext-playpause" data-action="playpause" title="${uiPaused ? 'Play' : 'Pause'}">
              <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor" style="display:${uiPaused ? 'block' : 'none'}">
                <polygon points="6 3 20 12 6 21 6 3"></polygon>
              </svg>
              <svg class="pause-icon" viewBox="0 0 24 24" fill="currentColor" style="display:${uiPaused ? 'none' : 'block'}">
                <rect x="6" y="4" width="4" height="16" rx="1"></rect>
                <rect x="14" y="4" width="4" height="16" rx="1"></rect>
              </svg>
            </button>
            <div class="slowmo-ext-presets slowmo-ext-fast">
              <button class="slowmo-ext-preset ${uiSpeed === 1 && !uiPaused ? 'active' : ''}" data-speed="1">1x</button>
              <button class="slowmo-ext-preset ${uiSpeed === 2 && !uiPaused ? 'active' : ''}" data-speed="2">2x</button>
              <button class="slowmo-ext-preset skip" data-action="skip" title="Skip all animations">∞</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    // Elements
    const container = root.querySelector('.slowmo-ext-container');
    const collapsed = root.querySelector('.slowmo-ext-collapsed');
    const header = root.querySelector('.slowmo-ext-header');
    const closeBtn = root.querySelector('.slowmo-ext-close');
    const playpauseBtn = root.querySelector('[data-action="playpause"]');
    const skipBtn = root.querySelector('[data-action="skip"]');
    const presetBtns = root.querySelectorAll('.slowmo-ext-preset[data-speed]');
    const speedBadge = root.querySelector('.slowmo-ext-badge');

    // Expand on click
    collapsed.addEventListener('click', (e) => {
      if (isDragging) return;
      isExpanded = true;
      container.classList.add('expanded');
      saveState();
    });

    // Collapse
    closeBtn.addEventListener('click', () => {
      isExpanded = false;
      container.classList.remove('expanded');
      saveState();
    });

    // Play/Pause
    playpauseBtn.addEventListener('click', () => {
      uiPaused = !uiPaused;
      setSpeed(uiPaused ? 0 : uiSpeed);
      updateUI();
      saveState();
    });

    // Skip
    skipBtn.addEventListener('click', () => {
      skipAnimations();
      // Flash the button to indicate action
      skipBtn.style.background = 'var(--accent)';
      skipBtn.style.color = '#000';
      setTimeout(() => {
        skipBtn.style.background = '';
        skipBtn.style.color = '';
      }, 200);
    });

    // Speed presets
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        uiSpeed = parseFloat(btn.dataset.speed);
        uiPaused = false;
        setSpeed(uiSpeed);
        updateUI();
        saveState();
      });
    });

    // Dragging
    function startDrag(e) {
      if (e.target.closest('button') && !e.target.closest('.slowmo-ext-collapsed') && !e.target.closest('.slowmo-ext-header')) return;
      isDragging = false;
      const rect = root.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;

      const onMove = (e) => {
        isDragging = true;
        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;
        const right = window.innerWidth - x - root.offsetWidth;
        const bottom = window.innerHeight - y - root.offsetHeight;
        root.style.right = Math.max(0, Math.min(right, window.innerWidth - 60)) + 'px';
        root.style.bottom = Math.max(0, Math.min(bottom, window.innerHeight - 60)) + 'px';
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (isDragging) {
          savePosition({
            right: parseInt(root.style.right),
            bottom: parseInt(root.style.bottom)
          });
          setTimeout(() => { isDragging = false; }, 50);
        }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    collapsed.addEventListener('mousedown', startDrag);
    header.addEventListener('mousedown', startDrag);

    function updateUI() {
      // Play/Pause button
      const playIcon = playpauseBtn.querySelector('.play-icon');
      const pauseIcon = playpauseBtn.querySelector('.pause-icon');
      playIcon.style.display = uiPaused ? 'block' : 'none';
      pauseIcon.style.display = uiPaused ? 'none' : 'block';
      playpauseBtn.title = uiPaused ? 'Play' : 'Pause';

      // Speed badge
      speedBadge.textContent = uiPaused ? '||' : formatSpeed(uiSpeed);

      // Preset buttons
      presetBtns.forEach(btn => {
        const speed = parseFloat(btn.dataset.speed);
        btn.classList.toggle('active', speed === uiSpeed && !uiPaused);
      });
    }

    return root;
  }

  function formatSpeed(speed) {
    if (speed < 1) return speed.toFixed(2).replace('0.', '.') + 'x';
    return speed.toFixed(0) + 'x';
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
                  speed: uiSpeed,
                  paused: uiPaused
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
                    speed: uiSpeed,
                    paused: uiPaused
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
  // INITIALIZE
  // ============================================

  if (isTopFrame) {
    // Top frame: load state, create UI, watch for iframes
    loadState();
    createUI();
    watchForNewIframes();

    // Sync existing iframes on load
    setTimeout(() => {
      broadcastToFrames(uiSpeed, uiPaused);
    }, 100);
  } else {
    // Iframe: just install slowmo, no UI
    // Speed will be synced via postMessage from parent
  }

})();
