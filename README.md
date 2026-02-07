# slowmo

Slow down, pause, or speed up time of any web content.

Debug animations, study cool demos, and make games easier or harder.

## Install

```bash
npm install slowmo
```

> **Chrome extension coming soon** - control any website's animations without writing code.

## Quick Start

```js
import slowmo from "slowmo";

slowmo(0.5); // half speed, that's it
```

## Full API

```js
import slowmo from "slowmo";

slowmo(0.5); // half speed
slowmo(2); // double speed
slowmo(0); // pause
slowmo(1); // normal

slowmo.pause(); // pause all
slowmo.play(); // resume
slowmo.reset(); // back to 1×
slowmo.getSpeed(); // current speed
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

## Dial Component

Visual UI control for slowmo speed - draggable, rotatable dial.

### Vanilla JS

```js
import { setupDial, shutdownDial } from "slowmo/dial";

setupDial(); // Mount dial to body (fixed position, draggable)
shutdownDial(); // Remove and cleanup
```

### React

```jsx
import { Slowmo } from "slowmo/react";

function App() {
  return <Slowmo />; // Handles lifecycle automatically
}
```

**Dial Features:**

- Center: Pause/play toggle
- Middle ring: Drag to reposition
- Outer edge: Rotate to change speed (uses Pointer Lock)
- Position persists in localStorage

## What It Works With

| Type                   | How                                          |
| ---------------------- | -------------------------------------------- |
| CSS Animations         | Web Animations API `playbackRate`            |
| CSS Transitions        | Web Animations API `playbackRate`            |
| Videos & Audio         | `playbackRate` property                      |
| requestAnimationFrame  | Patched timestamps                           |
| performance.now()      | Returns virtual time                         |
| Date.now()             | Returns virtual epoch time                   |
| setTimeout/setInterval | Scaled delays                                |
| GSAP                   | `globalTimeline.timeScale()` (auto-detected) |
| Three.js               | Uses rAF, works automatically                |
| Framer Motion/Motion   | Uses Date.now(), works automatically         |
| Canvas animations      | Uses rAF, works automatically                |

## Limitations

- **Frame-based animations** that don't use timestamps can't be smoothly slowed (they increment by a fixed amount each frame regardless of time)
- **Libraries that cache time function references** before slowmo loads may not be affected (the Chrome extension runs early to avoid this)
- **Video/audio** have browser-imposed limits (~0.0625x to 16x in Chrome)
- **iframes** won't be affected unless slowmo is also loaded inside them (the extension handles this automatically)
- **Service Workers & Worklets** run in separate threads that can't be patched (audio worklets, paint worklets, animation worklets)
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
