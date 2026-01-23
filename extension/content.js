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

  // Initialize
  install();

  // ============================================
  // UI CONTROLLER
  // ============================================

  const STORAGE_KEY = 'slowmo-controller-state';
  const POSITION_KEY = 'slowmo-controller-position';

  // Speed presets
  const speedPresets = [0.1, 0.25, 0.5, 1, 2, 4];

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
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
        overflow: hidden;
        user-select: none;
        transition: border-radius 0.2s, width 0.2s;
      }

      .slowmo-ext-container.expanded {
        border-radius: 12px;
      }

      .slowmo-ext-collapsed {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        cursor: grab;
        transition: background 0.15s;
      }

      .slowmo-ext-collapsed:hover {
        background: var(--bg-hover);
      }

      .slowmo-ext-collapsed:active {
        cursor: grabbing;
      }

      .slowmo-ext-collapsed.dragging {
        cursor: grabbing;
      }

      .slowmo-ext-collapsed svg {
        width: 24px;
        height: 24px;
        color: var(--accent);
      }

      .slowmo-ext-collapsed .speed-badge {
        position: absolute;
        top: 6px;
        right: 6px;
        font-size: 9px;
        font-weight: 600;
        color: var(--text);
        background: var(--bg-hover);
        padding: 2px 4px;
        border-radius: 4px;
        pointer-events: none;
      }

      .slowmo-ext-expanded {
        display: none;
        padding: 12px;
        min-width: 280px;
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

      .slowmo-ext-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 100px;
        padding: 6px;
      }

      .slowmo-ext-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        border-radius: 50%;
        cursor: pointer;
        color: var(--text-muted);
        transition: all 0.15s;
      }

      .slowmo-ext-btn:hover {
        background: var(--bg-hover);
        color: var(--text);
      }

      .slowmo-ext-btn.active {
        background: var(--accent);
        color: #000;
      }

      .slowmo-ext-btn svg {
        width: 16px;
        height: 16px;
      }

      .slowmo-ext-speed {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0 8px;
        min-width: 70px;
        justify-content: center;
      }

      .slowmo-ext-speed-value {
        font-family: 'SF Mono', 'Monaco', monospace;
        font-size: 14px;
        font-weight: 500;
        color: var(--text);
        min-width: 50px;
        text-align: center;
      }

      .slowmo-ext-speed-arrows {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .slowmo-ext-arrow {
        width: 18px;
        height: 12px;
        border: none;
        background: transparent;
        cursor: pointer;
        color: var(--text-dim);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: color 0.15s;
      }

      .slowmo-ext-arrow:hover {
        color: var(--text);
      }

      .slowmo-ext-arrow svg {
        width: 10px;
        height: 10px;
      }

      .slowmo-ext-presets {
        display: flex;
        gap: 4px;
        margin-top: 10px;
      }

      .slowmo-ext-preset {
        flex: 1;
        padding: 6px 8px;
        border: none;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 6px;
        cursor: pointer;
        font-family: 'SF Mono', 'Monaco', monospace;
        font-size: 11px;
        color: var(--text-dim);
        transition: all 0.15s;
      }

      .slowmo-ext-preset:hover {
        background: var(--bg-hover);
        color: var(--text-muted);
      }

      .slowmo-ext-preset.active {
        background: var(--accent-glow);
        color: var(--accent);
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
          <span class="speed-badge">${formatSpeed(uiSpeed)}</span>
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
                <polyline points="4 14 10 14 10 20"></polyline>
                <polyline points="20 10 14 10 14 4"></polyline>
                <line x1="14" y1="10" x2="21" y2="3"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            </button>
          </div>
          <div class="slowmo-ext-controls">
            <button class="slowmo-ext-btn ${uiPaused ? 'active' : ''}" data-action="pause" title="Pause/Play">
              <svg class="play-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:${uiPaused ? 'block' : 'none'}">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <svg class="pause-icon" viewBox="0 0 24 24" fill="currentColor" style="display:${uiPaused ? 'none' : 'block'}">
                <rect x="6" y="4" width="4" height="16" rx="1"></rect>
                <rect x="14" y="4" width="4" height="16" rx="1"></rect>
              </svg>
            </button>
            <div class="slowmo-ext-speed">
              <span class="slowmo-ext-speed-value">${uiPaused ? 'Paused' : formatSpeed(uiSpeed)}</span>
              <div class="slowmo-ext-speed-arrows">
                <button class="slowmo-ext-arrow" data-action="up" title="Faster">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="18 15 12 9 6 15"></polyline>
                  </svg>
                </button>
                <button class="slowmo-ext-arrow" data-action="down" title="Slower">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div class="slowmo-ext-presets">
            ${speedPresets.map(s => `<button class="slowmo-ext-preset ${s === uiSpeed && !uiPaused ? 'active' : ''}" data-speed="${s}">${formatSpeed(s)}</button>`).join('')}
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
    const pauseBtn = root.querySelector('[data-action="pause"]');
    const upBtn = root.querySelector('[data-action="up"]');
    const downBtn = root.querySelector('[data-action="down"]');
    const presetBtns = root.querySelectorAll('.slowmo-ext-preset');
    const speedBadge = root.querySelector('.speed-badge');
    const speedValue = root.querySelector('.slowmo-ext-speed-value');

    // Expand/collapse
    collapsed.addEventListener('click', (e) => {
      if (isDragging) return;
      isExpanded = true;
      container.classList.add('expanded');
      saveState();
    });

    closeBtn.addEventListener('click', () => {
      isExpanded = false;
      container.classList.remove('expanded');
      saveState();
    });

    // Pause/play
    pauseBtn.addEventListener('click', () => {
      uiPaused = !uiPaused;
      setSpeed(uiPaused ? 0 : uiSpeed);
      updateUI();
      saveState();
    });

    // Speed up/down
    upBtn.addEventListener('click', () => {
      const idx = speedPresets.findIndex(s => s >= uiSpeed);
      const nextIdx = Math.min(idx + 1, speedPresets.length - 1);
      uiSpeed = speedPresets[nextIdx];
      uiPaused = false;
      setSpeed(uiSpeed);
      updateUI();
      saveState();
    });

    downBtn.addEventListener('click', () => {
      const idx = speedPresets.findIndex(s => s >= uiSpeed);
      const prevIdx = Math.max(idx - 1, 0);
      uiSpeed = speedPresets[prevIdx];
      uiPaused = false;
      setSpeed(uiSpeed);
      updateUI();
      saveState();
    });

    // Presets
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
        collapsed.classList.add('dragging');
        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;

        // Calculate right/bottom from viewport
        const right = window.innerWidth - x - root.offsetWidth;
        const bottom = window.innerHeight - y - root.offsetHeight;

        root.style.right = Math.max(0, Math.min(right, window.innerWidth - 60)) + 'px';
        root.style.bottom = Math.max(0, Math.min(bottom, window.innerHeight - 60)) + 'px';
        root.style.left = 'auto';
        root.style.top = 'auto';
      };

      const onUp = () => {
        collapsed.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);

        if (isDragging) {
          savePosition({
            right: parseInt(root.style.right),
            bottom: parseInt(root.style.bottom)
          });
          // Reset dragging after a short delay to prevent click
          setTimeout(() => { isDragging = false; }, 50);
        }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    collapsed.addEventListener('mousedown', startDrag);
    header.addEventListener('mousedown', startDrag);

    function updateUI() {
      // Update pause button
      const playIcon = pauseBtn.querySelector('.play-icon');
      const pauseIcon = pauseBtn.querySelector('.pause-icon');
      playIcon.style.display = uiPaused ? 'block' : 'none';
      pauseIcon.style.display = uiPaused ? 'none' : 'block';
      pauseBtn.classList.toggle('active', uiPaused);

      // Update speed display
      speedValue.textContent = uiPaused ? 'Paused' : formatSpeed(uiSpeed);
      speedBadge.textContent = formatSpeed(uiSpeed);

      // Update presets
      presetBtns.forEach(btn => {
        btn.classList.toggle('active', parseFloat(btn.dataset.speed) === uiSpeed && !uiPaused);
      });
    }

    return root;
  }

  function formatSpeed(speed) {
    if (speed < 1) return speed.toFixed(2) + 'x';
    return speed.toFixed(1) + 'x';
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadState();
      createUI();
    });
  } else {
    loadState();
    createUI();
  }

})();
