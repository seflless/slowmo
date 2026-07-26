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

## Toolbar Component API

The compact toolbar provides a visual UI for controlling Slowmo playback.

### Vanilla JS (`slowmo/dial`)

```js
import { setupDial, shutdownDial, isDialActive } from 'slowmo/dial';

setupDial();         // Returns HTMLElement or null (if already active)
shutdownDial();      // Removes the toolbar and cleans up listeners
isDialActive();      // Returns boolean
```

**Singleton:** Only one toolbar can exist. A second `setupDial()` returns null.

### React (`slowmo/react`)

```jsx
import { Slowmo } from 'slowmo/react';
<Slowmo />  // Mount in app, auto-cleans on unmount
```

The legacy `slowmo/dial` import path and API names remain for compatibility.

### Toolbar interactions

- Click the left side to pause or resume.
- Drag the speed readout horizontally through 1/64×, 1/32×, 1/16×, 1/8×,
  1/4×, 1/2×, 1×, 2×, 4×, 8×, 16×, 32×, and ∞.
- Double-click the speed readout to reset to 1×.
- Drag the divider to move the toolbar.
- The toolbar docks to viewport edges and becomes vertical at the left or right.
- Hover the toolbar to reveal its close control.
- Close restores 1× and removes the toolbar until it is mounted or triggered again.
- The toolbar follows the system light/dark color scheme.

## What It Controls

| Animation Type | How It's Controlled |
|---------------|---------------------|
| CSS Animations | Web Animations API `playbackRate` |
| CSS Transitions | Web Animations API `playbackRate` |
| Videos/Audio | `playbackRate` property |
| requestAnimationFrame | Monkey-patch to scale timestamps |
| performance.now() | Returns virtual time |
| Date.now() | Returns virtual epoch time |
| setTimeout/setInterval | Scaled delays |
| GSAP | `gsap.globalTimeline.timeScale()` (if available) |
| Three.js | Uses rAF, so handled automatically |
| Framer Motion/Motion | Uses Date.now(), handled automatically |

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
1. CSS keyframe animation
2. `requestAnimationFrame`
3. Web Animations API
4. A locally hosted, looping video
5. A bundled Motion hover animation

The page uses the same draggable toolbar and speed presets as the package and
Chrome extension.

## Chrome Extension

The Chrome extension provides page-wide control with full iframe support.

### Extension Goals

1. **Single top-level control** - One toolbar controls the entire page
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
