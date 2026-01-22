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
