# slowmo Specification

## Overview

`slowmo` is a universal slow-motion controller for web pages. It intercepts time at multiple levels to slow down (or speed up) all animations on a page.

## API

```js
import { slowmo } from 'slowmo';

// Set speed (0.5 = half speed, 0.1 = 10x slower, 2 = 2x faster)
slowmo(0.5);

// Pause everything
slowmo(0);

// Back to normal
slowmo(1);

// Or use object API for more control
slowmo.setSpeed(0.5);
slowmo.pause();
slowmo.play();
slowmo.reset();
```

## Dial Component API

The dial provides a visual UI for controlling slowmo speed.

### Vanilla JS (`slowmo/dial`)

```js
import { setupDial, shutdownDial, isDialActive } from 'slowmo/dial';

setupDial();         // Returns HTMLElement or null (if already active)
shutdownDial();      // Removes dial, cleans up listeners
isDialActive();      // Returns boolean
```

**Singleton:** Only one dial can exist. Second `setupDial()` returns null.

### React (`slowmo/react`)

```jsx
import { Slowmo } from 'slowmo/react';
<Slowmo />  // Mount in app, auto-cleans on unmount
```

### Dial Interaction Zones

| Zone | Radius | Action |
|------|--------|--------|
| Center | 0-14px | Toggle pause/play |
| Middle | 14-24px | Drag to reposition |
| Outer | 24px+ | Rotate to change speed (Pointer Lock) |

### Speed Range

- Min: 1/60 (~0.017x)
- Max: 10x
- Snaps to 1x when close (0.92-1.08 range)

## What It Controls

| Animation Type | How It's Controlled |
|---------------|---------------------|
| CSS Animations | Web Animations API `playbackRate` |
| CSS Transitions | Inject `transition-duration` multiplier |
| Videos/Audio | `playbackRate` property |
| requestAnimationFrame | Monkey-patch to scale time delta |
| GSAP | `gsap.globalTimeline.timeScale()` (if available) |
| Three.js | Uses rAF, so handled automatically |
| Framer Motion | Uses Web Animations API, handled automatically |

## Speed Limits

| Animation Type | Min Speed | Max Speed | Notes |
|----------------|-----------|-----------|-------|
| Video/Audio | 0.0625 | 16x | Chrome limits; Safari only 0.5-2x |
| Web Animations | ~0 | unlimited | Very high speeds skip keyframes |
| rAF timestamps | ~0 | unlimited | High speeds = jerky movement |

**Practical recommendations:**
- **Slow motion**: 0.1x to 0.5x works great everywhere
- **Ultra slow**: 0.01x to 0.1x for debugging (video may not go this low)
- **Fast forward**: 2x is safe on all browsers, 4x on modern browsers

## Exclusions

Elements with `data-slowmo-exclude` attribute are not affected.

```html
<div data-slowmo-exclude>This animation runs at normal speed</div>
```

## Demo Page Requirements

The demo should showcase slowmo working with:
1. CSS keyframe animation (spinner, bounce)
2. CSS transition (hover effect)
3. Video player
4. Canvas animation (particles or similar)
5. Three.js 3D scene (rotating cube)
6. GSAP timeline
7. Framer Motion spring animation

Include a nice UI with a speed slider and preset buttons (0.1x, 0.25x, 0.5x, 1x, 2x).

## Chrome Extension

The Chrome extension provides page-wide control with full iframe support.

### Extension Goals

1. **Single top-level control** - One speed slider controls the entire page
2. **All frames synchronized** - Same speed applied to main page and all iframes
3. **Nested iframe support** - Works with iframes within iframes (any depth)
4. **Cross-origin iframes** - CodeSandbox, StackBlitz, embedded demos all work
5. **Dynamic iframes** - Newly added iframes automatically synchronized
6. **All animation types** - Every animation type works in every iframe

### How It Works

| Mechanism | Purpose |
|-----------|---------|
| `all_frames: true` in manifest | Chrome auto-injects content script into ALL frames |
| `broadcastToFrames()` | Parent sends postMessage to all child iframes on speed change |
| Message listener | Each iframe listens, applies speed, forwards to nested iframes |
| `MutationObserver` | Detects dynamically added iframes and syncs them |

### Iframe Sync Protocol

```js
// Message format
{
  type: 'slowmo-extension-sync',
  speed: 0.5,    // Current speed multiplier
  paused: false  // Whether playback is paused
}
```

### Test Scenarios

The extension should pass these iframe tests:

1. **Same-origin iframe** - Animations slow down correctly
2. **Cross-origin iframe** - Animations slow down (via content script injection)
3. **Nested iframes** - Parent → Child → Grandchild all synchronized
4. **Dynamic iframe** - iframe added via JS gets synchronized
5. **All animation types in iframe** - CSS, rAF, WAAPI, video, GSAP all work
6. **Speed changes propagate** - Changing speed updates all frames immediately
7. **Pause/resume propagates** - Pausing stops all frames, resume restarts all

## Testing

### Test Commands

```bash
npm run test:unit      # Unit tests (Vitest)
npm run test:e2e       # E2E tests (Playwright) - runs headlessly
npm run test:all       # Both unit + E2E
npm run test:e2e:extension  # Extension tests (requires headed Chrome)
```

### Test Coverage

| Category | Tests | What's Measured |
|----------|-------|-----------------|
| CSS Animations | 5 | playbackRate, pause, progress, exclusions |
| requestAnimationFrame | 4 | timestamp scaling, virtual time, pause |
| Web Animations API | 5 | playbackRate, currentTime, dynamic animations |
| Video/Audio | 8 | playbackRate, clamping, pause/resume |
| GSAP | 4 | globalTimeline.timeScale |
| iframe sync | 7 | postMessage sync, pause propagation |
| Unit tests | 29 | API, virtual time, tracking |

**Total: ~125 automated tests across Chromium/Firefox/WebKit**

### Manual Extension Testing

Automated Playwright tests cannot reliably inject Chrome extension content scripts. To manually verify extension iframe support:

1. Load extension: `chrome://extensions` → Developer mode → Load unpacked → `extension/`
2. Start test server: `npx vite --config vite.test.config.ts`
3. Open: `http://localhost:5174/tests/fixtures/extension-test.html`
4. Verify slowmo UI appears and controls ALL spinners (parent + 3 levels of iframes)

### Test Fixtures

| File | Purpose |
|------|---------|
| `tests/fixtures/extension-test.html` | Extension test - NO slowmo loaded |
| `tests/fixtures/plain-iframe.html` | Plain iframe for extension testing |
| `tests/fixtures/plain-iframe-nested.html` | Nested iframe (2 levels) |
| `tests/fixtures/plain-iframe-inner.html` | Inner iframe (3 levels deep) |
| `tests/fixtures/iframe-demo.html` | Manual demo WITH slowmo (not for extension) |
| `tests/fixtures/test-page.html` | E2E test page with all animation types |

### Gotchas

1. **Port 5173 vs 5174**: Demo runs on 5173, tests run on 5174. Don't mix them.
2. **Extension tests are skipped**: Playwright can't inject extensions reliably. Use manual testing.
3. **WebKit video timing**: One test skipped due to unreliable video timing in headless WebKit.
4. **iframe-demo.html vs extension-test.html**: The demo page HAS slowmo loaded. For testing the extension's injection, use `extension-test.html` which has NO slowmo.

## Future Work

1. **CI Integration** - Add GitHub Actions workflow for `npm run test:all`
2. **Cross-origin iframe testing** - Would require a separate origin server
3. **Extension E2E** - Consider Puppeteer for better extension support
4. **Visual regression** - Screenshot comparison tests for animation states
