(function() {
  "use strict";
  const EDGE_THRESHOLD = 16;
  const SPEED_STEP_PIXELS = 18;
  const ONE_X_SNAP_PIXELS = 9;
  const TOOLBAR_HEIGHT = 42;
  const HORIZONTAL_PILL_WIDTH = 84;
  const RING_PADDING = 12;
  const SHELL_BORDER_WIDTH = 2;
  const HORIZONTAL_SHELL_WIDTH = HORIZONTAL_PILL_WIDTH + RING_PADDING * 2 + SHELL_BORDER_WIDTH;
  const HORIZONTAL_SHELL_HEIGHT = TOOLBAR_HEIGHT + RING_PADDING * 2 + SHELL_BORDER_WIDTH;
  const VERTICAL_SHELL_WIDTH = TOOLBAR_HEIGHT + RING_PADDING * 2 + SHELL_BORDER_WIDTH;
  const VERTICAL_SHELL_HEIGHT = HORIZONTAL_PILL_WIDTH + RING_PADDING * 2 + SHELL_BORDER_WIDTH;
  const SPEEDS = [
    ...[64, 32, 16, 8, 4, 2].map((denominator) => ({
      value: 1 / denominator,
      numerator: 1,
      denominator
    })),
    { value: 1, whole: 1 },
    ...[2, 4, 8, 16, 32].map((whole) => ({ value: whole, whole })),
    { value: Number.POSITIVE_INFINITY, whole: Number.POSITIVE_INFINITY }
  ];
  const ONE_X_SPEED_INDEX = 6;
  const DEFAULT_TOOLBAR_CLOCK = {
    setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
    clearTimeout: (handle) => globalThis.clearTimeout(handle)
  };
  const TOOLBAR_CSS = `
  :host {
    all: initial;
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: block;
    width: auto;
    height: auto;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    overflow: hidden;
    pointer-events: none;
    color-scheme: light dark;
    --toolbar-bg: #1e1e1e;
    --toolbar-fg: #f2f1ed;
    --toolbar-border: rgba(255, 255, 255, 0.12);
    --toolbar-divider: rgba(255, 255, 255, 0.1);
    --toolbar-hover: rgba(255, 255, 255, 0.08);
    --toolbar-ring: rgba(120, 120, 120, 0.25);
    --toolbar-ring-border: rgba(255, 255, 255, 0.125);
    --toolbar-close-border: rgba(255, 255, 255, 0.2);
    --toolbar-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  }

  :host([data-layout="inline"]) {
    position: relative;
    inset: auto;
    width: 110px;
    height: 68px;
    overflow: visible;
  }

  @media (prefers-color-scheme: light) {
    :host {
      --toolbar-bg: #fff;
      --toolbar-fg: #292929;
      --toolbar-border: rgba(0, 0, 0, 0.12);
      --toolbar-divider: rgba(0, 0, 0, 0.08);
      --toolbar-hover: rgba(0, 0, 0, 0.12);
      --toolbar-ring-border: rgba(0, 0, 0, 0.05);
      --toolbar-close-border: rgba(0, 0, 0, 0.15);
      --toolbar-shadow: 0 5px 18px rgba(0, 0, 0, 0.15);
    }
  }

  * {
    box-sizing: border-box;
  }

  button {
    appearance: none;
    border: 0;
    font: inherit;
  }

  .toolbar-shell {
    position: absolute;
    width: fit-content;
    height: fit-content;
    padding: 12px;
    border: 1px solid transparent;
    border-radius: 35px;
    background: transparent;
    color: var(--toolbar-fg);
    overflow: visible;
    pointer-events: auto;
    user-select: none;
    transition:
      background-color 180ms ease,
      border-color 180ms ease;
  }

  .toolbar-shell.hovered,
  .toolbar-shell.dragging {
    border-color: var(--toolbar-ring-border);
    background: var(--toolbar-ring);
    cursor: grab;
  }

  .toolbar-shell.dragging {
    cursor: grabbing;
  }

  .toolbar-frame {
    position: relative;
    opacity: 1;
    transform: scale(1);
    transform-origin: center;
  }

  .toolbar-frame.entering {
    animation: toolbar-in 220ms ease-out both;
  }

  .toolbar-frame.leaving {
    animation: toolbar-out 180ms ease-in both;
  }

  @keyframes toolbar-in {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }

  @keyframes toolbar-out {
    from { opacity: 1; transform: scale(1); }
    to { opacity: 0; transform: scale(0.9); }
  }

  .toolbar-pill {
    position: relative;
    display: flex;
    width: 84px;
    height: 42px;
    border: 1px solid var(--toolbar-border);
    border-radius: 21px;
    background: var(--toolbar-bg);
    color: var(--toolbar-fg);
    box-shadow: var(--toolbar-shadow);
    overflow: hidden;
  }

  .toolbar-pill.vertical {
    width: 42px;
    height: 84px;
    flex-direction: column;
  }

  .pill-half {
    position: relative;
    z-index: 1;
    display: flex;
    flex: 0 0 42px;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 100%;
    padding: 0;
    background: transparent;
    color: inherit;
    cursor: default;
    transition: background-color 180ms ease;
  }

  .toolbar-pill.vertical .pill-half {
    width: 100%;
    height: 42px;
  }

  .toolbar-pill.hover-left .play-half,
  .toolbar-pill.hover-right .speed-half {
    background: var(--toolbar-hover);
  }

  .toolbar-pill.hover-left .play-half {
    cursor: pointer;
  }

  .toolbar-pill.hover-right .speed-half {
    cursor: ew-resize;
  }

  .play-half svg {
    position: relative;
    left: 2px;
  }

  .toolbar-pill.vertical .play-half svg {
    left: 0;
  }

  .speed-half {
    min-width: 42px;
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
    font-size: 12px;
    letter-spacing: -0.02em;
  }

  .speed-half.scrubbing {
    cursor: none !important;
  }

  .speed-readout {
    position: relative;
    left: 0;
    top: 1px;
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    gap: 0;
    line-height: 1;
    text-align: center;
  }

  .toolbar-pill.vertical .speed-readout {
    left: 2px;
    top: -1px;
  }

  .speed-number-slot {
    display: inline-flex;
    width: 20px;
    flex: 0 0 20px;
    align-items: center;
    justify-content: center;
  }

  .speed-whole {
    display: inline-block;
    width: 28px;
    color: inherit;
    font-size: 14px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    text-align: center;
  }

  .speed-fraction {
    position: relative;
    top: -1px;
    display: inline-flex;
    width: fit-content;
    flex-direction: column;
    align-items: center;
    color: inherit;
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }

  .speed-numerator {
    display: block;
    width: 100%;
    font-size: 0.65em;
    text-align: center;
  }

  .speed-fraction-line {
    display: block;
    width: 80%;
    height: 1px;
    margin: 1px auto;
    background: currentColor;
  }

  .speed-denominator {
    display: block;
    width: 100%;
    text-align: center;
  }

  .speed-infinity {
    position: relative;
    top: -1px;
    font-size: 24px;
    font-weight: 400;
    line-height: 1;
  }

  .speed-multiplier {
    position: relative;
    top: -1px;
    flex: 0 0 auto;
    margin: 0;
    padding: 0;
    font-size: 10px;
    line-height: 1;
    opacity: 0.7;
  }

  .pill-divider {
    position: absolute;
    left: 50%;
    top: 0;
    z-index: 2;
    width: 8px;
    height: 100%;
    padding: 0;
    background: transparent;
    cursor: grab;
    pointer-events: auto;
    transform: translateX(-50%);
  }

  .pill-divider:active,
  .toolbar-shell.dragging .pill-divider {
    cursor: grabbing;
  }

  .pill-divider::before {
    content: "";
    position: absolute;
    left: 50%;
    top: 0;
    width: 2px;
    height: 100%;
    background: var(--toolbar-divider);
    pointer-events: none;
    transform: translateX(-50%);
  }

  .toolbar-pill.vertical .pill-divider {
    left: 0;
    top: 50%;
    width: 100%;
    height: 8px;
    transform: translateY(-50%);
  }

  .toolbar-pill.vertical .pill-divider::before {
    left: 0;
    top: 50%;
    width: 100%;
    height: 1px;
    transform: translateY(-50%);
  }

  .close-button {
    position: absolute;
    right: 0;
    top: 0;
    z-index: 10;
    display: grid;
    width: 22px;
    height: 22px;
    place-items: center;
    padding: 0;
    border: 1px solid var(--toolbar-close-border);
    border-radius: 50%;
    background: var(--toolbar-bg);
    color: var(--toolbar-fg);
    cursor: pointer;
    opacity: 0;
    pointer-events: auto;
    transform: scale(0.9);
    transform-origin: center;
    transition:
      opacity 50ms ease,
      transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .toolbar-shell.hovered .close-button,
  .close-button:focus-visible {
    opacity: 0.9;
  }

  .toolbar-shell.hovered .close-button:hover,
  .close-button:focus-visible {
    opacity: 1;
    transform: scale(1);
  }

  .close-button svg {
    transform: translateX(0.5px);
  }

  svg {
    display: block;
  }

  .tooltip {
    position: fixed;
    z-index: 20;
    padding: 6px 8px;
    border-radius: 8px;
    background: #111;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 11px;
    line-height: 1.2;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
  }

  .tooltip.above {
    transform: translate(-50%, -100%);
  }

  .tooltip.below {
    transform: translateX(-50%);
  }

  @media (prefers-reduced-motion: reduce) {
    .toolbar-frame.entering,
    .toolbar-frame.leaving {
      animation-duration: 1ms;
    }

    .toolbar-shell,
    .pill-half,
    .close-button,
    .speed-readout {
      transition-duration: 1ms !important;
    }
  }
`;
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  function appendSvgElement(parent, tagName, attributes) {
    const element = document.createElementNS(SVG_NAMESPACE, tagName);
    Object.entries(attributes).forEach(([name, value]) => {
      element.setAttribute(name, value);
    });
    parent.appendChild(element);
    return element;
  }
  function createIcon(name) {
    const svg = document.createElementNS(SVG_NAMESPACE, "svg");
    svg.setAttribute("width", name === "close" ? "11" : "13");
    svg.setAttribute("height", name === "close" ? "11" : "13");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    if (name === "pause") {
      appendSvgElement(svg, "rect", {
        x: "6",
        y: "4",
        width: "4",
        height: "16",
        rx: "1",
        fill: "currentColor",
        stroke: "none"
      });
      appendSvgElement(svg, "rect", {
        x: "14",
        y: "4",
        width: "4",
        height: "16",
        rx: "1",
        fill: "currentColor",
        stroke: "none"
      });
    } else if (name === "play") {
      appendSvgElement(svg, "path", {
        d: "M7 4.8v14.4L19 12 7 4.8Z",
        fill: "currentColor",
        stroke: "currentColor"
      });
    } else {
      appendSvgElement(svg, "path", {
        d: "M18 6 6 18M6 6l12 12"
      });
    }
    return svg;
  }
  function createFakeCursor() {
    const cursor = document.createElement("div");
    cursor.className = "slowmo-fake-cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.style.cssText = `
    all: initial;
    position: fixed;
    z-index: 2147483647;
    width: 32px;
    height: 32px;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    overflow: visible;
    pointer-events: none;
    transform: translate(-50%, -50%);
  `;
    const svg = document.createElementNS(SVG_NAMESPACE, "svg");
    svg.setAttribute("width", "32");
    svg.setAttribute("height", "32");
    svg.setAttribute("viewBox", "0 0 32 32");
    svg.setAttribute("fill", "none");
    appendSvgElement(svg, "path", {
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: "M19.763 12c.225.001.451.054.653.155l5.508 2.755c.498.249.808.75.808 1.307 0 .557-.31 1.058-.808 1.307l-5.508 2.755a1.46 1.46 0 0 1-2.114-1.307v-5.51c0-.4.158-.775.446-1.051A1.46 1.46 0 0 1 19.763 12ZM12.84 12.001c.806 0 1.462.655 1.462 1.462v5.509a1.462 1.462 0 0 1-2.115 1.307l-5.505-2.755a1.46 1.46 0 0 1 0-2.614l5.505-2.755c.203-.101.428-.154.653-.154Z",
      fill: "white"
    });
    appendSvgElement(svg, "path", {
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: "m25.477 15.805-5.508-2.755a.461.461 0 0 0-.667.413v5.509c0 .343.36.566.667.413l5.508-2.755a.461.461 0 0 0 0-.825ZM7.129 16.63l5.505 2.755a.462.462 0 0 0 .668-.413v-5.509a.462.462 0 0 0-.668-.413l-5.505 2.755a.461.461 0 0 0 0 .825Z",
      fill: "black"
    });
    cursor.appendChild(svg);
    return cursor;
  }
  function isToolbarDockEdge(value) {
    return [
      "none",
      "left",
      "right",
      "top",
      "bottom",
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right"
    ].includes(String(value));
  }
  function isToolbarPoint(value) {
    if (!value || typeof value !== "object") return false;
    const point = value;
    return typeof point.xPct === "number" && typeof point.yPct === "number" && Number.isFinite(point.xPct) && Number.isFinite(point.yPct) && point.xPct >= 0 && point.xPct <= 1 && point.yPct >= 0 && point.yPct <= 1;
  }
  function findClosestSpeedIndex(speed) {
    if (speed === Number.POSITIVE_INFINITY) return SPEEDS.length - 1;
    let closestIndex = ONE_X_SPEED_INDEX;
    let closestDistance = Number.POSITIVE_INFINITY;
    SPEEDS.forEach((entry, index) => {
      if (!Number.isFinite(entry.value)) return;
      const distance = Math.abs(Math.log(entry.value) - Math.log(Math.max(speed, 1 / 64)));
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    return closestIndex;
  }
  function viewportSize() {
    const root = document.documentElement;
    return {
      // clientWidth/clientHeight exclude classic page scrollbars. innerWidth and
      // innerHeight do not, which can put a docked toolbar underneath them.
      width: (root == null ? void 0 : root.clientWidth) || window.innerWidth,
      height: (root == null ? void 0 : root.clientHeight) || window.innerHeight
    };
  }
  function stateForPlacement(placement) {
    if (isToolbarPoint(placement)) {
      return {
        position: placement,
        dockEdge: "none",
        isVertical: false
      };
    }
    const placements = {
      "top-left": {
        position: { xPct: 0, yPct: 0 },
        dockEdge: "top-left",
        isVertical: false
      },
      "top-center": {
        position: { xPct: 0.5, yPct: 0 },
        dockEdge: "top",
        isVertical: false
      },
      "top-right": {
        position: { xPct: 1, yPct: 0 },
        dockEdge: "top-right",
        isVertical: false
      },
      left: {
        position: { xPct: 0, yPct: 0.5 },
        dockEdge: "left",
        isVertical: true
      },
      center: {
        position: { xPct: 0.5, yPct: 0.5 },
        dockEdge: "none",
        isVertical: false
      },
      right: {
        position: { xPct: 1, yPct: 0.5 },
        dockEdge: "right",
        isVertical: true
      },
      "bottom-left": {
        position: { xPct: 0, yPct: 1 },
        dockEdge: "bottom-left",
        isVertical: false
      },
      "bottom-center": {
        position: { xPct: 0.5, yPct: 1 },
        dockEdge: "bottom",
        isVertical: false
      },
      "bottom-right": {
        position: { xPct: 1, yPct: 1 },
        dockEdge: "bottom-right",
        isVertical: false
      }
    };
    return placements[placement];
  }
  function createDial(options) {
    var _a, _b, _c;
    const clock = options.clock ?? DEFAULT_TOOLBAR_CLOCK;
    const initialSpeed = options.initialSpeed && options.initialSpeed > 0 ? options.initialSpeed : 1;
    const fallbackState = stateForPlacement(options.defaultPlacement ?? "bottom-right");
    const initialState = {
      position: isToolbarPoint((_a = options.initialState) == null ? void 0 : _a.position) ? options.initialState.position : fallbackState.position,
      dockEdge: isToolbarDockEdge((_b = options.initialState) == null ? void 0 : _b.dockEdge) ? options.initialState.dockEdge : fallbackState.dockEdge,
      isVertical: typeof ((_c = options.initialState) == null ? void 0 : _c.isVertical) === "boolean" ? options.initialState.isVertical : fallbackState.isVertical
    };
    const host = document.createElement("div");
    let layoutMode = options.layout ?? "floating";
    host.className = "slowmo-toolbar";
    host.setAttribute("data-slowmo-exclude", "");
    host.setAttribute("data-layout", layoutMode);
    host.setAttribute("role", "presentation");
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = TOOLBAR_CSS;
    shadow.appendChild(style);
    const shell = document.createElement("div");
    shell.className = "toolbar-shell";
    shell.setAttribute("role", "toolbar");
    shell.setAttribute("aria-label", "Slowmo playback controls");
    const frame = document.createElement("div");
    frame.className = "toolbar-frame entering";
    const pill = document.createElement("div");
    pill.className = "toolbar-pill";
    const playButton = document.createElement("button");
    playButton.className = "pill-half play-half";
    playButton.type = "button";
    const speedButton = document.createElement("button");
    speedButton.className = "pill-half speed-half";
    speedButton.type = "button";
    speedButton.setAttribute(
      "aria-label",
      "Playback speed. Drag or use arrow keys to change; Home resets to 1×."
    );
    const divider = document.createElement("span");
    divider.className = "pill-divider";
    divider.setAttribute("aria-hidden", "true");
    const closeButton = document.createElement("button");
    closeButton.className = "close-button";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Hide toolbar");
    closeButton.appendChild(createIcon("close"));
    pill.append(playButton, speedButton, divider);
    frame.appendChild(pill);
    shell.append(frame, closeButton);
    shadow.appendChild(shell);
    let speedIndex = findClosestSpeedIndex(initialSpeed);
    let isPlaying = !(options.initialPaused ?? false);
    let isVertical = initialState.isVertical;
    let dockEdge = initialState.dockEdge;
    let position = initialState.position;
    let activeAnchor = options.anchor ?? null;
    let isDragging = false;
    let didDrag = false;
    let isScrubbing = false;
    let hoverZone = "dead";
    let overscroll = 0;
    let scrubPixelRemainder = 0;
    let tooltipTimer = null;
    let tooltip = null;
    let closeTimer = null;
    let destroyed = false;
    const dragStart = { x: 0, y: 0 };
    const dragOffset = { x: 0, y: 0 };
    const scrubStart = { x: 0, y: 0 };
    const fakeCursorPosition = { x: 0, y: 0 };
    const fakeCursor = createFakeCursor();
    function shellDimensions(vertical = isVertical) {
      return vertical ? { width: VERTICAL_SHELL_WIDTH, height: VERTICAL_SHELL_HEIGHT } : { width: HORIZONTAL_SHELL_WIDTH, height: HORIZONTAL_SHELL_HEIGHT };
    }
    function clampPosition(nextPosition, vertical = isVertical) {
      const dimensions = shellDimensions(vertical);
      const { width, height } = viewportSize();
      let x = nextPosition.xPct * width;
      let y = nextPosition.yPct * height;
      if (dockEdge.includes("left")) x = dimensions.width / 2;
      if (dockEdge.includes("right")) x = width - dimensions.width / 2;
      if (dockEdge.includes("top")) y = dimensions.height / 2;
      if (dockEdge.includes("bottom")) y = height - dimensions.height / 2;
      x = Math.max(dimensions.width / 2, Math.min(width - dimensions.width / 2, x));
      y = Math.max(dimensions.height / 2, Math.min(height - dimensions.height / 2, y));
      return {
        xPct: width > 0 ? x / width : 0.5,
        yPct: height > 0 ? y / height : 0.5
      };
    }
    function updatePosition() {
      if (layoutMode === "inline") {
        shell.style.left = "50%";
        shell.style.top = "50%";
        shell.style.transform = "translate(-50%, -50%)";
        return;
      }
      if (activeAnchor == null ? void 0 : activeAnchor.isConnected) {
        const rect = activeAnchor.getBoundingClientRect();
        const dimensions = shellDimensions(false);
        const gap = options.anchorGap ?? 12;
        const side = options.anchorSide ?? "bottom";
        const center = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
        if (side === "top") center.y = rect.top - gap - dimensions.height / 2;
        if (side === "bottom") center.y = rect.bottom + gap + dimensions.height / 2;
        if (side === "left") center.x = rect.left - gap - dimensions.width / 2;
        if (side === "right") center.x = rect.right + gap + dimensions.width / 2;
        dockEdge = "none";
        isVertical = false;
        const viewport = viewportSize();
        position = {
          xPct: viewport.width > 0 ? center.x / viewport.width : 0.5,
          yPct: viewport.height > 0 ? center.y / viewport.height : 0.5
        };
        shell.style.left = `${center.x}px`;
        shell.style.top = `${center.y}px`;
        shell.style.transform = "translate(-50%, -50%)";
        return;
      } else if (activeAnchor) {
        activeAnchor = null;
      }
      position = clampPosition(position);
      const { width, height } = viewportSize();
      shell.style.left = `${position.xPct * width}px`;
      shell.style.top = `${position.yPct * height}px`;
      shell.style.transform = "translate(-50%, -50%)";
    }
    function saveState() {
      var _a2;
      (_a2 = options.onStateChange) == null ? void 0 : _a2.call(options, {
        position,
        dockEdge,
        isVertical
      });
    }
    function renderPlayIcon() {
      playButton.replaceChildren(createIcon(isPlaying ? "pause" : "play"));
      playButton.setAttribute("aria-label", isPlaying ? "Pause animations" : "Play animations");
    }
    function renderSpeed() {
      const entry = SPEEDS[speedIndex];
      const readout = document.createElement("span");
      readout.className = "speed-readout";
      readout.style.transform = `translateX(${overscroll}px)`;
      readout.style.transition = isScrubbing ? "none" : "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)";
      const slot = document.createElement("span");
      slot.className = "speed-number-slot";
      if (entry.whole === Number.POSITIVE_INFINITY) {
        const infinity = document.createElement("span");
        infinity.className = "speed-infinity";
        infinity.textContent = "∞";
        slot.appendChild(infinity);
        readout.style.left = "0";
        readout.style.top = "0";
      } else if (entry.whole !== void 0) {
        const whole = document.createElement("span");
        whole.className = "speed-whole";
        whole.textContent = String(entry.whole);
        slot.appendChild(whole);
      } else {
        const fraction = document.createElement("span");
        fraction.className = "speed-fraction";
        const numerator = document.createElement("span");
        numerator.className = "speed-numerator";
        numerator.textContent = String(entry.numerator);
        const line = document.createElement("span");
        line.className = "speed-fraction-line";
        const denominator = document.createElement("span");
        denominator.className = "speed-denominator";
        denominator.textContent = String(entry.denominator);
        fraction.append(numerator, line, denominator);
        slot.appendChild(fraction);
      }
      readout.appendChild(slot);
      if (entry.whole !== Number.POSITIVE_INFINITY) {
        const multiplier = document.createElement("span");
        multiplier.className = "speed-multiplier";
        multiplier.textContent = "×";
        multiplier.setAttribute("aria-label", "times");
        readout.appendChild(multiplier);
      }
      speedButton.replaceChildren(readout);
    }
    function renderOrientation() {
      pill.classList.toggle("vertical", isVertical);
    }
    function renderHoverZone() {
      pill.classList.toggle("hover-left", hoverZone === "left");
      pill.classList.toggle("hover-right", hoverZone === "right");
    }
    function selectedSpeed() {
      return SPEEDS[speedIndex].value;
    }
    function applySelectedSpeed() {
      options.onSpeedChange(isPlaying ? selectedSpeed() : 0);
    }
    function updateSpeedIndex(nextIndex) {
      speedIndex = Math.max(0, Math.min(SPEEDS.length - 1, nextIndex));
      renderSpeed();
      if (isPlaying) options.onSpeedChange(selectedSpeed());
    }
    function setPlaybackState(speed, paused = false) {
      speedIndex = findClosestSpeedIndex(speed);
      isPlaying = !paused && speed !== 0;
      renderPlayIcon();
      renderSpeed();
      applySelectedSpeed();
    }
    function clearTooltip() {
      if (tooltipTimer) {
        clock.clearTimeout(tooltipTimer);
        tooltipTimer = null;
      }
      tooltip == null ? void 0 : tooltip.remove();
      tooltip = null;
    }
    function showTooltipDelayed(label, control) {
      clearTooltip();
      tooltipTimer = clock.setTimeout(() => {
        if (destroyed) return;
        const rect = control.getBoundingClientRect();
        const hasRoomAbove = rect.top > 30;
        tooltip = document.createElement("div");
        tooltip.className = `tooltip ${hasRoomAbove ? "above" : "below"}`;
        tooltip.setAttribute("role", "tooltip");
        tooltip.textContent = label;
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${hasRoomAbove ? rect.top - 8 : rect.bottom + 8}px`;
        shadow.appendChild(tooltip);
      }, 600);
    }
    function getHoverZone(clientX, clientY) {
      const rect = pill.getBoundingClientRect();
      const pointerPosition = isVertical ? clientY - rect.top : clientX - rect.left;
      const dividerPosition = (isVertical ? rect.height : rect.width) / 2;
      if (pointerPosition >= dividerPosition - 2 && pointerPosition <= dividerPosition + 2) {
        return "dead";
      }
      return pointerPosition < dividerPosition ? "left" : "right";
    }
    function beginDrag(event, force = false) {
      if (event.button !== 0) return;
      if (!force && dockEdge === "none" && event.target.closest(".toolbar-pill")) {
        return;
      }
      if (!force && event.target.closest("button")) return;
      event.preventDefault();
      event.stopPropagation();
      clearTooltip();
      activeAnchor = null;
      if (layoutMode === "inline") {
        const inlineRect = shell.getBoundingClientRect();
        const viewport = viewportSize();
        document.body.appendChild(host);
        layoutMode = "floating";
        host.setAttribute("data-layout", layoutMode);
        dockEdge = "none";
        position = {
          xPct: (inlineRect.left + inlineRect.width / 2) / viewport.width,
          yPct: (inlineRect.top + inlineRect.height / 2) / viewport.height
        };
        updatePosition();
        elevateFloatingToolbar();
      }
      const rect = shell.getBoundingClientRect();
      dragOffset.x = event.clientX - (rect.left + rect.width / 2);
      dragOffset.y = event.clientY - (rect.top + rect.height / 2);
      dragStart.x = event.clientX;
      dragStart.y = event.clientY;
      isDragging = true;
      didDrag = false;
      shell.classList.add("dragging");
    }
    function handleDragMove(event) {
      if (!isDragging) return;
      if (Math.abs(event.clientX - dragStart.x) > 4 || Math.abs(event.clientY - dragStart.y) > 4) {
        didDrag = true;
      }
      const centerX = event.clientX - dragOffset.x;
      const centerY = event.clientY - dragOffset.y;
      const viewport = viewportSize();
      const distanceToLeft = centerX;
      const distanceToRight = viewport.width - centerX;
      const distanceToTop = centerY;
      const distanceToBottom = viewport.height - centerY;
      const nearHorizontalWall = distanceToLeft <= EDGE_THRESHOLD + VERTICAL_SHELL_WIDTH / 2 || distanceToRight <= EDGE_THRESHOLD + VERTICAL_SHELL_WIDTH / 2;
      const nearVerticalWall = distanceToTop <= EDGE_THRESHOLD + HORIZONTAL_SHELL_HEIGHT / 2 || distanceToBottom <= EDGE_THRESHOLD + HORIZONTAL_SHELL_HEIGHT / 2;
      let nextVertical = isVertical;
      if (nearHorizontalWall && !nearVerticalWall) nextVertical = true;
      if (nearVerticalWall && !nearHorizontalWall) nextVertical = false;
      dockEdge = "none";
      if (nextVertical !== isVertical) {
        isVertical = nextVertical;
        renderOrientation();
      }
      const dimensions = shellDimensions();
      const x = Math.max(
        dimensions.width / 2,
        Math.min(viewport.width - dimensions.width / 2, centerX)
      );
      const y = Math.max(
        dimensions.height / 2,
        Math.min(viewport.height - dimensions.height / 2, centerY)
      );
      position = {
        xPct: viewport.width > 0 ? x / viewport.width : 0.5,
        yPct: viewport.height > 0 ? y / viewport.height : 0.5
      };
      updatePosition();
    }
    function finishDrag() {
      if (!isDragging) return;
      if (didDrag) {
        const rect = shell.getBoundingClientRect();
        const viewport = viewportSize();
        const nearLeft = rect.left <= EDGE_THRESHOLD;
        const nearRight = viewport.width - rect.right <= EDGE_THRESHOLD;
        const nearTop = rect.top <= EDGE_THRESHOLD;
        const nearBottom = viewport.height - rect.bottom <= EDGE_THRESHOLD;
        if (nearTop && nearLeft) dockEdge = "top-left";
        else if (nearTop && nearRight) dockEdge = "top-right";
        else if (nearBottom && nearLeft) dockEdge = "bottom-left";
        else if (nearBottom && nearRight) dockEdge = "bottom-right";
        else if (nearLeft) dockEdge = "left";
        else if (nearRight) dockEdge = "right";
        else if (nearTop) dockEdge = "top";
        else if (nearBottom) dockEdge = "bottom";
        else dockEdge = "none";
        const isCorner = dockEdge.includes("-");
        if (!isCorner) {
          if (dockEdge === "left" || dockEdge === "right") isVertical = true;
          if (dockEdge === "top" || dockEdge === "bottom") isVertical = false;
        }
        renderOrientation();
        updatePosition();
        saveState();
      }
      isDragging = false;
      shell.classList.remove("dragging");
      clock.setTimeout(() => {
        didDrag = false;
      }, 0);
    }
    function beginSpeedScrub(event) {
      var _a2, _b2;
      if (event.button !== 0 || getHoverZone(event.clientX, event.clientY) !== "right") return;
      event.preventDefault();
      event.stopPropagation();
      clearTooltip();
      scrubStart.x = event.clientX;
      scrubStart.y = event.clientY;
      fakeCursorPosition.x = event.clientX;
      fakeCursorPosition.y = event.clientY;
      fakeCursor.style.left = `${fakeCursorPosition.x}px`;
      fakeCursor.style.top = `${fakeCursorPosition.y}px`;
      document.documentElement.appendChild(fakeCursor);
      if (typeof fakeCursor.showPopover === "function") {
        try {
          fakeCursor.setAttribute("popover", "manual");
          fakeCursor.showPopover();
        } catch {
        }
      }
      scrubPixelRemainder = 0;
      isScrubbing = true;
      speedButton.classList.add("scrubbing");
      renderSpeed();
      try {
        const request = (_a2 = speedButton.requestPointerLock) == null ? void 0 : _a2.call(speedButton);
        (_b2 = request == null ? void 0 : request.catch) == null ? void 0 : _b2.call(request, () => void 0);
      } catch {
      }
    }
    function handleScrubMove(event) {
      if (!isScrubbing) return;
      const delta = event.movementX;
      const viewport = viewportSize();
      fakeCursorPosition.x += delta;
      if (fakeCursorPosition.x > viewport.width) fakeCursorPosition.x = 0;
      if (fakeCursorPosition.x < 0) fakeCursorPosition.x = viewport.width;
      fakeCursor.style.left = `${fakeCursorPosition.x}px`;
      fakeCursor.style.top = `${scrubStart.y}px`;
      scrubPixelRemainder += delta;
      if (speedIndex === 0 && delta < 0) {
        scrubPixelRemainder = 0;
        overscroll = Math.max(-5, overscroll + delta * 0.15);
        renderSpeed();
        return;
      }
      if (speedIndex === SPEEDS.length - 1 && delta > 0) {
        scrubPixelRemainder = 0;
        overscroll = Math.min(5, overscroll + delta * 0.15);
        renderSpeed();
        return;
      }
      overscroll = 0;
      if (speedIndex !== ONE_X_SPEED_INDEX) {
        const directionToOne = Math.sign(ONE_X_SPEED_INDEX - speedIndex);
        const remainingPixels = (ONE_X_SPEED_INDEX - speedIndex) * SPEED_STEP_PIXELS - scrubPixelRemainder;
        if (Math.sign(scrubPixelRemainder) === directionToOne && Math.abs(remainingPixels) <= ONE_X_SNAP_PIXELS) {
          updateSpeedIndex(ONE_X_SPEED_INDEX);
          scrubPixelRemainder = 0;
          return;
        }
      }
      const steps = Math.trunc(scrubPixelRemainder / SPEED_STEP_PIXELS);
      if (steps === 0) return;
      const previousIndex = speedIndex;
      updateSpeedIndex(speedIndex + steps);
      scrubPixelRemainder = speedIndex === previousIndex ? 0 : scrubPixelRemainder - steps * SPEED_STEP_PIXELS;
    }
    function finishScrub() {
      if (!isScrubbing) return;
      if (document.pointerLockElement) document.exitPointerLock();
      isScrubbing = false;
      scrubPixelRemainder = 0;
      speedButton.classList.remove("scrubbing");
      fakeCursor.remove();
      clock.setTimeout(() => {
        overscroll = 0;
        renderSpeed();
      }, 0);
    }
    function handlePointerLockChange() {
      if (isScrubbing && !document.pointerLockElement) finishScrub();
    }
    function handleResize() {
      updatePosition();
    }
    function elevateFloatingToolbar() {
      if (layoutMode !== "floating" || !host.isConnected || typeof host.showPopover !== "function") {
        return;
      }
      try {
        host.setAttribute("popover", "manual");
        if (!host.matches(":popover-open")) host.showPopover();
      } catch {
      }
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTooltip();
      if (closeTimer) clock.clearTimeout(closeTimer);
      finishScrub();
      document.removeEventListener("mousemove", handleDocumentMouseMove);
      document.removeEventListener("mouseup", handleDocumentMouseUp);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize);
      try {
        if (host.matches(":popover-open")) host.hidePopover();
      } catch {
      }
      host.remove();
    }
    function close() {
      var _a2, _b2;
      if (destroyed || frame.classList.contains("leaving")) return;
      clearTooltip();
      isPlaying = true;
      (_a2 = options.onPauseToggle) == null ? void 0 : _a2.call(options, false);
      options.onSpeedChange(1);
      (_b2 = options.onClose) == null ? void 0 : _b2.call(options);
      frame.classList.remove("entering");
      frame.classList.add("leaving");
      closeTimer = clock.setTimeout(() => {
        var _a3;
        destroy();
        (_a3 = options.onClosed) == null ? void 0 : _a3.call(options);
      }, 180);
    }
    function handleDocumentMouseMove(event) {
      handleDragMove(event);
      handleScrubMove(event);
    }
    function handleDocumentMouseUp() {
      finishDrag();
      finishScrub();
    }
    pill.addEventListener("mousemove", (event) => {
      hoverZone = getHoverZone(event.clientX, event.clientY);
      renderHoverZone();
    });
    pill.addEventListener("mouseleave", () => {
      hoverZone = "dead";
      renderHoverZone();
    });
    shell.addEventListener("mouseenter", () => shell.classList.add("hovered"));
    shell.addEventListener("mouseleave", () => {
      shell.classList.remove("hovered");
      clearTooltip();
    });
    shell.addEventListener("mousedown", (event) => beginDrag(event));
    divider.addEventListener("mousedown", (event) => beginDrag(event, true));
    playButton.addEventListener("mouseenter", () => {
      showTooltipDelayed(isPlaying ? "Pause all animations" : "Play all animations", playButton);
    });
    playButton.addEventListener("mouseleave", clearTooltip);
    playButton.addEventListener("mousedown", (event) => event.stopPropagation());
    playButton.addEventListener("click", (event) => {
      var _a2;
      event.stopPropagation();
      isPlaying = !isPlaying;
      renderPlayIcon();
      (_a2 = options.onPauseToggle) == null ? void 0 : _a2.call(options, !isPlaying);
      applySelectedSpeed();
    });
    speedButton.addEventListener("mouseenter", () => {
      showTooltipDelayed("Scrub through speed presets", speedButton);
    });
    speedButton.addEventListener("mouseleave", clearTooltip);
    speedButton.addEventListener("mousedown", beginSpeedScrub);
    speedButton.addEventListener("dblclick", () => updateSpeedIndex(ONE_X_SPEED_INDEX));
    speedButton.addEventListener("keydown", (event) => {
      let nextIndex = null;
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        nextIndex = speedIndex - 1;
      } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        nextIndex = speedIndex + 1;
      } else if (event.key === "Home") {
        nextIndex = ONE_X_SPEED_INDEX;
      } else if (event.key === "End") {
        nextIndex = SPEEDS.length - 1;
      }
      if (nextIndex === null) return;
      event.preventDefault();
      updateSpeedIndex(nextIndex);
    });
    closeButton.addEventListener("mouseenter", () => {
      showTooltipDelayed("Hide the toolbar", closeButton);
    });
    closeButton.addEventListener("mouseleave", clearTooltip);
    closeButton.addEventListener("mousedown", (event) => event.stopPropagation());
    closeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      close();
    });
    document.addEventListener("mousemove", handleDocumentMouseMove);
    document.addEventListener("mouseup", handleDocumentMouseUp);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, { passive: true });
    renderPlayIcon();
    renderSpeed();
    renderOrientation();
    updatePosition();
    applySelectedSpeed();
    clock.setTimeout(() => frame.classList.remove("entering"), 220);
    if (layoutMode === "floating") queueMicrotask(elevateFloatingToolbar);
    host.close = close;
    host.destroy = destroy;
    host.setPlaybackState = setPlaybackState;
    return host;
  }
  const DEFAULT_STORAGE_KEY = "slowmo-toolbar-placement-v1";
  const DEFAULT_TOOLBAR_SHORTCUT = "Mod+Shift+S";
  function normalizeState(value) {
    if (!value) return {};
    return {
      position: isToolbarPoint(value.position) ? value.position : void 0,
      dockEdge: isToolbarDockEdge(value.dockEdge) ? value.dockEdge : void 0,
      isVertical: typeof value.isVertical === "boolean" ? value.isVertical : void 0
    };
  }
  function createLocalStorageToolbarPersistence(key = DEFAULT_STORAGE_KEY) {
    return {
      load() {
        if (typeof localStorage === "undefined") return null;
        try {
          const raw = localStorage.getItem(key);
          return raw ? normalizeState(JSON.parse(raw)) : null;
        } catch {
          return null;
        }
      },
      save(state) {
        if (typeof localStorage === "undefined") return;
        try {
          localStorage.setItem(key, JSON.stringify(state));
        } catch {
        }
      }
    };
  }
  function eventMatchesShortcut(event, shortcut) {
    const parts = shortcut.split("+").map((part) => part.trim().toLowerCase()).filter(Boolean);
    const key = parts.find(
      (part) => !["mod", "meta", "command", "cmd", "control", "ctrl", "alt", "option", "shift"].includes(part)
    );
    if (!key || event.key.toLowerCase() !== key) return false;
    const isApple = typeof navigator !== "undefined" && /mac|iphone|ipad|ipod/i.test(navigator.platform);
    const expectsMod = parts.includes("mod");
    const expectsMeta = parts.some((part) => ["meta", "command", "cmd"].includes(part)) || expectsMod && isApple;
    const expectsCtrl = parts.some((part) => ["control", "ctrl"].includes(part)) || expectsMod && !isApple;
    const expectsAlt = parts.some((part) => ["alt", "option"].includes(part));
    const expectsShift = parts.includes("shift");
    return event.metaKey === expectsMeta && event.ctrlKey === expectsCtrl && event.altKey === expectsAlt && event.shiftKey === expectsShift;
  }
  function isEditableTarget(target) {
    return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  }
  function createSlowmoToolbarHost(options) {
    const controller = options.controller;
    let currentOptions = { ...options };
    let element = null;
    let openState = false;
    let destroyed = false;
    const host = {
      controller,
      open() {
        var _a;
        if (destroyed || typeof document === "undefined") return null;
        if (openState && (element == null ? void 0 : element.isConnected)) return element;
        if (element) {
          element.destroy();
          element = null;
        }
        controller.reset();
        openState = true;
        const persistence = currentOptions.persistence === false ? null : currentOptions.persistence ?? createLocalStorageToolbarPersistence();
        const initialState = normalizeState((persistence == null ? void 0 : persistence.load()) ?? null);
        const nextElement = createDial({
          layout: currentOptions.layout,
          defaultPlacement: currentOptions.defaultPlacement,
          initialState,
          anchor: currentOptions.anchor,
          anchorSide: currentOptions.anchorSide,
          anchorGap: currentOptions.anchorGap,
          initialSpeed: 1,
          initialPaused: false,
          onSpeedChange: (speed) => controller.setSpeed(speed),
          onClose: () => {
            var _a2;
            if (element !== nextElement) return;
            openState = false;
            controller.destroy();
            (_a2 = currentOptions.onOpenChange) == null ? void 0 : _a2.call(currentOptions, false);
          },
          onClosed: () => {
            if (element === nextElement) element = null;
          },
          clock: currentOptions.clock,
          onStateChange: (state) => {
            const activePersistence = currentOptions.persistence === false ? null : currentOptions.persistence ?? createLocalStorageToolbarPersistence();
            activePersistence == null ? void 0 : activePersistence.save(state);
          }
        });
        element = nextElement;
        (currentOptions.mountTarget ?? document.body).appendChild(nextElement);
        (_a = currentOptions.onOpenChange) == null ? void 0 : _a.call(currentOptions, true);
        return nextElement;
      },
      close() {
        if (!openState) {
          controller.destroy();
          return;
        }
        element == null ? void 0 : element.close();
      },
      toggle() {
        if (openState) host.close();
        else host.open();
      },
      reset() {
        if (element && openState) {
          element.setPlaybackState(1, false);
        } else {
          controller.reset();
        }
      },
      update(nextOptions) {
        if (destroyed) return;
        const previousDefaultOpen = currentOptions.defaultOpen;
        currentOptions = { ...currentOptions, ...nextOptions, controller };
        if (nextOptions.mountTarget && element && element.parentElement !== nextOptions.mountTarget) {
          nextOptions.mountTarget.appendChild(element);
        }
        if (nextOptions.defaultOpen !== previousDefaultOpen) {
          if (nextOptions.defaultOpen === false) host.close();
          if (nextOptions.defaultOpen === true) host.open();
        }
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        if (typeof window !== "undefined") {
          window.removeEventListener("keydown", handleKeyDown);
        }
        element == null ? void 0 : element.destroy();
        element = null;
        openState = false;
        controller.destroy();
      },
      isOpen() {
        return openState;
      },
      getElement() {
        return element;
      }
    };
    function handleKeyDown(event) {
      const shortcut = currentOptions.shortcut === void 0 ? DEFAULT_TOOLBAR_SHORTCUT : currentOptions.shortcut;
      if (!shortcut || event.defaultPrevented || event.repeat || isEditableTarget(event.target) || !eventMatchesShortcut(event, shortcut)) {
        return;
      }
      event.preventDefault();
      host.toggle();
    }
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown);
    }
    if (currentOptions.defaultOpen !== false) host.open();
    return host;
  }
  const COMMAND_EVENT = "slowmo-extension-command-v1";
  const COMMAND_MESSAGE = "slowmo-extension-command-message-v1";
  const SESSION_ENDED_MESSAGE = "slowmo-extension-session-ended-v1";
  const STORAGE_KEY = "toolbarPlacementV1";
  function dispatchCommand(command) {
    document.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: command }));
    void chrome.runtime.sendMessage({
      type: COMMAND_MESSAGE,
      sessionToken: window.__slowmoExtensionSessionTokenV1,
      command: command.command,
      ...command.command === "set-speed" ? {
        speed: Number.isFinite(command.speed) ? command.speed : "infinity"
      } : {}
    });
  }
  function createBridgeController() {
    let snapshot = {
      status: "inactive",
      speed: 1,
      paused: false
    };
    const subscribers = /* @__PURE__ */ new Set();
    function emit() {
      for (const subscriber of subscribers) subscriber(snapshot);
    }
    const controller = {
      activate() {
        if (snapshot.status === "active") return;
        snapshot = { status: "active", speed: 1, paused: false };
        dispatchCommand({ command: "set-speed", speed: 1 });
        emit();
      },
      setSpeed(speed) {
        controller.activate();
        snapshot = {
          status: "active",
          speed,
          paused: speed === 0
        };
        dispatchCommand({ command: "set-speed", speed });
        emit();
      },
      pause() {
        controller.setSpeed(0);
      },
      play() {
        controller.setSpeed(snapshot.speed > 0 ? snapshot.speed : 1);
      },
      reset() {
        controller.setSpeed(1);
      },
      destroy() {
        if (snapshot.status === "inactive") return;
        dispatchCommand({ command: "deactivate" });
        snapshot = { status: "inactive", speed: 1, paused: false };
        emit();
        void chrome.runtime.sendMessage({
          type: SESSION_ENDED_MESSAGE,
          sessionToken: window.__slowmoExtensionSessionTokenV1
        });
      },
      getSpeed() {
        return snapshot.speed;
      },
      getSnapshot() {
        return snapshot;
      },
      subscribe(subscriber) {
        subscribers.add(subscriber);
        subscriber(snapshot);
        return () => subscribers.delete(subscriber);
      }
    };
    return controller;
  }
  async function waitForBody() {
    if (document.body) return;
    await new Promise((resolve) => {
      document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
    });
  }
  async function mountToolbar() {
    await waitForBody();
    if (window.__slowmoExtensionToolbarHostV1) {
      window.__slowmoExtensionToolbarHostV1.reset();
      window.__slowmoExtensionToolbarHostV1.open();
      return;
    }
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    let cachedState = stored[STORAGE_KEY] ?? null;
    const persistence = {
      load: () => cachedState,
      save: (state) => {
        cachedState = state;
        void chrome.storage.local.set({ [STORAGE_KEY]: state });
      }
    };
    window.__slowmoExtensionToolbarHostV1 = createSlowmoToolbarHost({
      controller: createBridgeController(),
      persistence,
      shortcut: false,
      defaultPlacement: "bottom-right"
    });
  }
  void mountToolbar();
})();
