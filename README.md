# slowmo

Slow down or speed up time on any web page.

## Install

```bash
npm install slowmo
```

> **Chrome extension coming soon** - control any website's animations without writing code.

## Quick Start

```js
import slowmo from "slowmo"

slowmo(0.5) // half speed, that's it
```

## Full API

```js
import slowmo from "slowmo"

slowmo(0.5)           // half speed
slowmo(2)             // double speed
slowmo(0)             // pause
slowmo(1)             // normal

slowmo.pause()        // pause all
slowmo.play()         // resume
slowmo.reset()        // back to 1×
slowmo.getSpeed()     // current speed
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
