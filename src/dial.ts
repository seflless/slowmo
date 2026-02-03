/**
 * slowmo Rotary Dial Controller
 *
 * A draggable, rotatable dial for controlling playback speed.
 * - Center: Click to pause/play, drag to reposition
 * - Outer wheel: Drag to rotate and change speed (radial atan2-based)
 */

// ============================================
// CONSTANTS
// ============================================

const DIAL_SIZE = 64;
const DIAL_RADIUS = DIAL_SIZE / 2;

// Interaction zone radii (from center)
const PAUSE_ZONE_RADIUS = 14;
// Outer wheel: PAUSE_ZONE_RADIUS <= r <= DIAL_RADIUS

// Speed range
const MIN_SPEED = 1 / 60;  // ~0.0167 (1 frame per second at 60fps)
const MAX_SPEED = 10;

// Rotation range: symmetric visual limits, 1x at center (0°)
// Both sides stop 22.5° from straight down
const MIN_ANGLE = -157.5;  // At speed 1/60 (down-left)
const MAX_ANGLE = 157.5;   // At speed 10 (down-right)

// Snap to 1x within this range
const SNAP_SPEED_MIN = 0.92;
const SNAP_SPEED_MAX = 1.08;

// Delay before center zone shows move cursor hint (ms)
const HOLD_DELAY_MS = 150;

// Minimum drag distance to count as a drag (pixels)
const MIN_DRAG_DISTANCE = 3;

// localStorage key for position only (speed is NOT persisted)
const POSITION_KEY = 'slowmo-dial-position';

// Colors
const COLOR_BG = '#2A2A2A';
const COLOR_BRASS = '#797058';

// ============================================
// MATH UTILITIES
// ============================================

/**
 * Convert angle to speed using piecewise logarithmic scale.
 * - Negative angles (MIN_ANGLE to 0°): speeds MIN_SPEED to 1
 * - Positive angles (0° to MAX_ANGLE): speeds 1 to MAX_SPEED
 * This keeps 1x at 0° (triangle straight up) with symmetric visual limits.
 */
function angleToSpeed(angle: number): number {
  let speed: number;

  if (angle <= 0) {
    // Slow side: MIN_ANGLE (-157.5°) → 0° maps to MIN_SPEED → 1
    const t = (angle - MIN_ANGLE) / (0 - MIN_ANGLE);  // 0 at MIN_ANGLE, 1 at 0°
    speed = MIN_SPEED * Math.pow(1 / MIN_SPEED, t);
  } else {
    // Fast side: 0° → MAX_ANGLE (157.5°) maps to 1 → MAX_SPEED
    const t = angle / MAX_ANGLE;  // 0 at 0°, 1 at MAX_ANGLE
    speed = 1 * Math.pow(MAX_SPEED / 1, t);
  }

  // Snap to 1x if close
  if (speed >= SNAP_SPEED_MIN && speed <= SNAP_SPEED_MAX) {
    return 1;
  }

  return speed;
}

/**
 * Convert speed to angle (inverse of angleToSpeed).
 * Piecewise: slow speeds map to negative angles, fast speeds to positive.
 */
function speedToAngle(speed: number): number {
  const clampedSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));

  if (clampedSpeed <= 1) {
    // Slow side: MIN_SPEED → 1 maps to MIN_ANGLE → 0°
    const logMin = Math.log(MIN_SPEED);
    const logSpeed = Math.log(clampedSpeed);
    const t = (logSpeed - logMin) / (0 - logMin);  // 0 at MIN_SPEED, 1 at 1
    return MIN_ANGLE + t * (0 - MIN_ANGLE);
  } else {
    // Fast side: 1 → MAX_SPEED maps to 0° → MAX_ANGLE
    const logMax = Math.log(MAX_SPEED);
    const logSpeed = Math.log(clampedSpeed);
    const t = logSpeed / logMax;  // 0 at 1, 1 at MAX_SPEED
    return t * MAX_ANGLE;
  }
}

/**
 * Format speed for display.
 */
function formatSpeed(speed: number): string {
  if (speed >= 10) return '10';
  if (speed >= 1) {
    const formatted = speed.toFixed(1);
    return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
  }
  if (speed >= 0.1) {
    return speed.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }
  // Very slow speeds
  return speed.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * Clamp angle to valid range.
 */
function clampAngle(angle: number): number {
  return Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, angle));
}

/**
 * Calculate distance from center of dial.
 */
function distanceFromCenter(x: number, y: number, rect: DOMRect): number {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  return Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
}

/**
 * Calculate mouse angle relative to dial center (in degrees).
 * 0° = straight up, positive = clockwise.
 */
function mouseAngle(x: number, y: number, rect: DOMRect): number {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  // atan2 gives angle from positive X axis, counter-clockwise
  // We want 0° = up, positive = clockwise
  const radians = Math.atan2(x - centerX, centerY - y);
  return radians * (180 / Math.PI);
}

/**
 * Normalize angle delta to [-180, 180] range to handle wraparound.
 */
function normalizeAngleDelta(delta: number): number {
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

// ============================================
// DIAL CREATION
// ============================================

export interface DialOptions {
  onSpeedChange: (speed: number) => void;
  onPauseToggle?: (paused: boolean) => void;
  initialSpeed?: number;
  initialPaused?: boolean;
}

export function createDial(options: DialOptions): HTMLElement {
  const { onSpeedChange, onPauseToggle } = options;

  // State - always start at 1x, not persisted
  let currentAngle = speedToAngle(options.initialSpeed ?? 1);
  let isPaused = options.initialPaused ?? false;

  // Interaction state
  type Zone = 'center' | 'wheel' | null;
  let mouseDownZone: Zone = null;
  let hasDragged = false;
  let holdDelayTimer: ReturnType<typeof setTimeout> | null = null;

  // For center zone dragging (reposition)
  let dragStartRight = 0;
  let dragStartBottom = 0;
  let dragStartMouseX = 0;
  let dragStartMouseY = 0;

  // For wheel zone rotation
  let startMouseAngle = 0;
  let startDialAngle = 0;

  // Load saved position
  let position = { right: 20, bottom: 20 };
  try {
    const savedPos = localStorage.getItem(POSITION_KEY);
    if (savedPos) {
      position = JSON.parse(savedPos);
    }
  } catch {}

  // Create container
  const container = document.createElement('div');
  container.className = 'slowmo-dial';
  container.style.cssText = `
    position: fixed;
    right: ${position.right}px;
    bottom: ${position.bottom}px;
    width: ${DIAL_SIZE}px;
    height: ${DIAL_SIZE}px;
    z-index: 2147483647;
    user-select: none;
    font-family: ui-monospace, 'SF Mono', Monaco, monospace;
  `;

  // The notches SVG (extracted from user's dial.svg design)
  // These are radial lines around the edge - brass colored
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

  // SVG structure
  const svg = `
    <svg viewBox="0 0 ${DIAL_SIZE} ${DIAL_SIZE}" style="width:100%;height:100%;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.5));">
      <!-- Background circle -->
      <circle cx="${DIAL_RADIUS}" cy="${DIAL_RADIUS}" r="${DIAL_RADIUS}" fill="${COLOR_BG}"/>

      <!-- Rotating notches group (includes triangle indicator) -->
      <g class="dial-notch" transform="rotate(${currentAngle}, ${DIAL_RADIUS}, ${DIAL_RADIUS})">
        ${notchesSvg}
      </g>

      <!-- Pause/Play icon in center -->
      <g class="dial-pause-icon" transform="translate(${DIAL_RADIUS}, ${DIAL_RADIUS})">
        ${isPaused
          ? `<path d="M-4.5 -8.5L7.5 0L-4.5 8.5Z" fill="${COLOR_BRASS}" stroke="${COLOR_BRASS}" stroke-width="1.5" stroke-linejoin="round"/>`
          : `<line x1="-4.5" y1="-8" x2="-4.5" y2="8" stroke="${COLOR_BRASS}" stroke-width="3" stroke-linecap="round"/>
             <line x1="5.5" y1="-8" x2="5.5" y2="8" stroke="${COLOR_BRASS}" stroke-width="3" stroke-linecap="round"/>`
        }
      </g>
    </svg>
  `;

  container.innerHTML = svg;

  // Speed display overlay
  const speedDisplay = document.createElement('div');
  speedDisplay.className = 'dial-speed';
  speedDisplay.style.cssText = `
    position: absolute;
    bottom: -18px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 11px;
    font-weight: 600;
    color: #a8a29e;
    pointer-events: none;
    white-space: nowrap;
  `;
  speedDisplay.textContent = isPaused ? 'paused' : formatSpeed(angleToSpeed(currentAngle)) + 'x';
  container.appendChild(speedDisplay);

  // ============================================
  // UPDATE FUNCTIONS
  // ============================================

  function updateNotch() {
    const notch = container.querySelector('.dial-notch') as SVGGElement;
    if (notch) {
      notch.setAttribute('transform', `rotate(${currentAngle}, ${DIAL_RADIUS}, ${DIAL_RADIUS})`);
    }
  }

  function updatePauseIcon() {
    const iconGroup = container.querySelector('.dial-pause-icon') as SVGGElement;
    if (iconGroup) {
      iconGroup.innerHTML = isPaused
        ? `<path d="M-4.5 -8.5L7.5 0L-4.5 8.5Z" fill="${COLOR_BRASS}" stroke="${COLOR_BRASS}" stroke-width="1.5" stroke-linejoin="round"/>`
        : `<line x1="-4.5" y1="-8" x2="-4.5" y2="8" stroke="${COLOR_BRASS}" stroke-width="3" stroke-linecap="round"/>
           <line x1="5.5" y1="-8" x2="5.5" y2="8" stroke="${COLOR_BRASS}" stroke-width="3" stroke-linecap="round"/>`;
    }
  }

  function updateSpeedDisplay() {
    speedDisplay.textContent = isPaused ? 'paused' : formatSpeed(angleToSpeed(currentAngle)) + 'x';
  }

  function savePosition() {
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify({
        right: parseInt(container.style.right),
        bottom: parseInt(container.style.bottom)
      }));
    } catch {}
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  function clearHoldTimer() {
    if (holdDelayTimer !== null) {
      clearTimeout(holdDelayTimer);
      holdDelayTimer = null;
    }
  }

  function handleMouseDown(e: MouseEvent) {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const dist = distanceFromCenter(e.clientX, e.clientY, rect);

    if (dist < PAUSE_ZONE_RADIUS) {
      // Center zone - could be click (pause/play) or drag (reposition)
      mouseDownZone = 'center';
      hasDragged = false;
      dragStartMouseX = e.clientX;
      dragStartMouseY = e.clientY;
      dragStartRight = parseInt(container.style.right) || 0;
      dragStartBottom = parseInt(container.style.bottom) || 0;

      // Start timer to show move cursor hint if held
      holdDelayTimer = setTimeout(() => {
        if (mouseDownZone === 'center' && !hasDragged) {
          container.style.cursor = 'move';
        }
      }, HOLD_DELAY_MS);
    } else if (dist <= DIAL_RADIUS) {
      // Outer wheel zone - rotation
      mouseDownZone = 'wheel';
      startMouseAngle = mouseAngle(e.clientX, e.clientY, rect);
      startDialAngle = currentAngle;
      // Hide cursor so user can see the triangle indicator while rotating
      document.body.style.cursor = 'none';
    }
  }

  function handleMouseMove(e: MouseEvent) {
    const rect = container.getBoundingClientRect();

    if (mouseDownZone === 'center') {
      // Check if moved enough to count as drag
      const dx = e.clientX - dragStartMouseX;
      const dy = e.clientY - dragStartMouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > MIN_DRAG_DISTANCE) {
        hasDragged = true;
        clearHoldTimer();
        document.body.style.cursor = 'move';

        // Reposition dial: move by the same delta as the mouse
        // Mouse moved by (dx, dy), so dial should move by same amount
        // Since we use right/bottom positioning, moving right decreases 'right', moving down decreases 'bottom'
        const right = dragStartRight - dx;
        const bottom = dragStartBottom - dy;

        // Clamp to viewport
        container.style.right = Math.max(0, Math.min(right, window.innerWidth - DIAL_SIZE)) + 'px';
        container.style.bottom = Math.max(0, Math.min(bottom, window.innerHeight - DIAL_SIZE)) + 'px';
      }
    } else if (mouseDownZone === 'wheel') {
      // Rotate dial based on mouse angle
      const currentMouseAngle = mouseAngle(e.clientX, e.clientY, rect);

      // Check if mouse is in the "dead zone" at the bottom (beyond the dial's limits)
      // Dead zone: angles beyond ±157.5° (within 22.5° of straight down)
      const inDeadZone = Math.abs(currentMouseAngle) > MAX_ANGLE;

      if (inDeadZone) {
        // When in dead zone, clamp to the nearest limit based on which side we're on
        // and reset references to prevent jumps when exiting the dead zone
        const clampedMouseAngle = currentMouseAngle > 0 ? MAX_ANGLE : MIN_ANGLE;
        currentAngle = clampedMouseAngle;
        startMouseAngle = currentMouseAngle;
        startDialAngle = currentAngle;
      } else {
        const delta = normalizeAngleDelta(currentMouseAngle - startMouseAngle);
        const newAngle = startDialAngle + delta;
        const clampedAngle = clampAngle(newAngle);

        // If we hit a limit, reset the start reference so we "stick" at the limit
        if (clampedAngle !== newAngle) {
          startMouseAngle = currentMouseAngle;
          startDialAngle = clampedAngle;
        }

        currentAngle = clampedAngle;
      }

      updateNotch();
      updateSpeedDisplay();

      if (!isPaused) {
        onSpeedChange(angleToSpeed(currentAngle));
      }
    } else {
      // Not dragging - update hover cursor
      const dist = distanceFromCenter(e.clientX, e.clientY, rect);
      if (dist < PAUSE_ZONE_RADIUS) {
        container.style.cursor = 'pointer';
      } else if (dist <= DIAL_RADIUS) {
        container.style.cursor = 'grab';
      } else {
        container.style.cursor = '';
      }
    }
  }

  function handleMouseUp() {
    clearHoldTimer();

    if (mouseDownZone === 'center' && !hasDragged) {
      // Quick click in center - toggle pause/play
      isPaused = !isPaused;
      updatePauseIcon();
      updateSpeedDisplay();
      onPauseToggle?.(isPaused);
      if (!isPaused) {
        onSpeedChange(angleToSpeed(currentAngle));
      } else {
        onSpeedChange(0);
      }
    }

    if (mouseDownZone === 'center' && hasDragged) {
      savePosition();
    }

    // Reset state
    mouseDownZone = null;
    hasDragged = false;
    document.body.style.cursor = '';
    container.style.cursor = '';
  }

  function handleMouseLeave() {
    // Reset cursor when mouse leaves dial (only if not dragging)
    if (mouseDownZone === null) {
      container.style.cursor = '';
    }
  }

  // Attach events
  container.addEventListener('mousedown', handleMouseDown);
  container.addEventListener('mousemove', handleMouseMove);
  container.addEventListener('mouseleave', handleMouseLeave);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Initial speed callback
  if (!isPaused) {
    onSpeedChange(angleToSpeed(currentAngle));
  }

  // Cleanup function (can be called when removing dial)
  (container as any).destroy = () => {
    clearHoldTimer();
    container.removeEventListener('mousedown', handleMouseDown);
    container.removeEventListener('mousemove', handleMouseMove);
    container.removeEventListener('mouseleave', handleMouseLeave);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  return container;
}

export default createDial;
