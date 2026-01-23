# slowmo

Control time on any web page. Debug, study, or speedrun animations.

<!-- TODO: Add hero GIF/video here -->
<!-- ![slowmo demo](./assets/demo.gif) -->

## Why?

- **Debug animations** - Slow things down to see exactly what's happening
- **Study details** - Appreciate the little details on why something looks so neat
- **Speedrun UIs** - Skip or skim quickly through any animation gated experience
- **Game difficulty** - Slower gives you better reflexes, faster challenges you more

## Install

```bash
npm install slowmo
```

> **Chrome Extension coming soon** - Control any website's animations without writing code.

## Quick Start

```js
import { slowmo } from "slowmo";

slowmo(0.5); // That's it, now anything that moves will go half speed.
```

## Full API

```js
import { slowmo } from "slowmo";

// Set speed (0.5 = half speed, 2 = double speed)
slowmo(0.5);

// Pause everything
slowmo(0);

// Back to normal
slowmo(1);

// Object API for more control
slowmo.setSpeed(0.5);
slowmo.pause();
slowmo.play();
slowmo.reset();
slowmo.getSpeed(); // Returns current speed
```

### Speed Guide

| Speed | Effect                           |
| ----- | -------------------------------- |
| `0`   | Paused                           |
| `0.1` | 10x slower (great for debugging) |
| `0.5` | Half speed                       |
| `1`   | Normal                           |
| `2`   | Double speed                     |

### Excluding Elements

Add `data-slowmo-exclude` to opt out specific elements:

```html
<div data-slowmo-exclude>This animation runs at normal speed</div>
```

## What It Works With

| Type                  | How                                          |
| --------------------- | -------------------------------------------- |
| CSS Animations        | Web Animations API `playbackRate`            |
| CSS Transitions       | Web Animations API `playbackRate`            |
| Videos & Audio        | `playbackRate` property                      |
| requestAnimationFrame | Patched timestamps                           |
| performance.now()     | Returns virtual time                         |
| GSAP                  | `globalTimeline.timeScale()` (auto-detected) |
| Three.js              | Uses rAF, works automatically                |
| Framer Motion         | Uses Web Animations API, works automatically |
| Canvas animations     | Uses rAF, works automatically                |

## Limitations

- **Frame-based animations** that don't use timestamps can't be smoothly slowed (they increment by a fixed amount each frame regardless of time)
- **Libraries that cache time function references** before slowmo loads may not be affected
- **Video/audio** have browser-imposed limits (~0.0625x to 16x in Chrome)
- **iframes** won't be affected unless slowmo is also loaded inside them
- **Web Workers & Worklets** run in separate threads with their own timing APIs that can't be patched from the main thread (audio worklets, paint worklets, animation worklets)
- **WebGL shaders** with custom time uniforms need manual integration
- **Server-synced animations** that rely on server timestamps rather than local time

## Contributing

Open to contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and Chrome extension testing instructions.

## Inspiration

Inspired by [agentation](https://agentation.dev/) by [Benji Taylor](https://x.com/BenjiTaylor) and his related blog posts [[1]](https://benji.org/annotating) [[2]](https://benji.org/agentation)

## License

MIT

---

<!-- TODO: Update with actual website URL -->

[website](https://slowmo.dev) · [github](https://github.com/seflless/slowmo) · [npm](https://www.npmjs.com/package/slowmo)
