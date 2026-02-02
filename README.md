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

## Dial Component

Visual UI control for slowmo speed - draggable, rotatable dial.

### Vanilla JS

```js
import { setupDial, shutdownDial } from 'slowmo/dial';

setupDial();      // Mount dial to body (fixed position, draggable)
shutdownDial();   // Remove and cleanup
```

### React

```jsx
import { Slowmo } from 'slowmo/react';

function App() {
  return <Slowmo />;  // Handles lifecycle automatically
}
```

**Dial Features:**
- Center: Pause/play toggle
- Middle ring: Drag to reposition
- Outer edge: Rotate to change speed (uses Pointer Lock)
- Position persists in localStorage

## What It Works With

| Type                  | How                                          |
| --------------------- | -------------------------------------------- |
| CSS Animations        | Web Animations API `playbackRate`            |
| CSS Transitions       | Web Animations API `playbackRate`            |
| Videos & Audio        | `playbackRate` property                      |
| requestAnimationFrame | Patched timestamps                           |
| performance.now()     | Returns virtual time                         |
| Date.now()            | Returns virtual epoch time                   |
| setTimeout/setInterval| Scaled delays                                |
| GSAP                  | `globalTimeline.timeScale()` (auto-detected) |
| Three.js              | Uses rAF, works automatically                |
| Framer Motion/Motion  | Uses Date.now(), works automatically         |
| Canvas animations     | Uses rAF, works automatically                |

## Animation Recreation (AI-Powered)

slowmo includes an AI-powered animation recreation skill that can analyze videos/GIFs and generate code to recreate them.

### CLI Usage

```bash
# Install globally or use npx
npx slowmo-recreate ./animation.mp4 --runtime framer-motion --api-key $GEMINI_API_KEY

# Generate GSAP code
npx slowmo-recreate ./demo.gif -r gsap -o animation.js

# Analyze only (no code generation)
npx slowmo-recreate ./video.mp4 -a --format json
```

### Programmatic Usage

```js
import { recreate } from "slowmo/recreate"

const result = await recreate({
  source: "./animation.mp4",
  runtime: "framer-motion", // or 'gsap', 'css', 'remotion', etc.
  apiKey: process.env.GEMINI_API_KEY,
})

console.log(result.code.code) // Generated animation code
console.log(result.analysis) // AI analysis of the animation
```

### Supported Runtimes

| Runtime        | Description                         |
| -------------- | ----------------------------------- |
| `css`          | Native CSS @keyframes               |
| `framer-motion`| React animation library             |
| `gsap`         | Professional-grade animation        |
| `remotion`     | React video framework               |
| `motion-one`   | Lightweight animation library       |
| `anime`        | Anime.js                            |
| `three`        | Three.js 3D animations              |
| `lottie`       | JSON animation format               |
| `react-spring` | Spring-physics React animations     |
| `popmotion`    | Functional animation library        |

### AI Backends

- **Gemini** (default) - Best for video understanding
- **OpenAI** - GPT-4 Vision
- **Anthropic** - Claude

Set your API key via environment variable (`GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`) or pass it directly.

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
