# slowmo

Control time on the web. Slow down, pause, or speed up CSS animations, Web
Animations, videos, `requestAnimationFrame`, timers, GSAP, Motion, and more.

```bash
npm install slowmo
```

Prefer to use it on arbitrary sites? [Install the Chrome extension](https://chromewebstore.google.com/detail/slowmo/mofjcfdoeioofnpbhipdjmldfokfndoa).

## Choose an integration

| Use case | Import |
|---|---|
| Build your own controls | `slowmo` |
| Add the standard toolbar with vanilla JS | `slowmo/toolbar` |
| Use hooks or the standard toolbar in React | `slowmo/react` |
| Control sites without changing their source | Chrome extension |

The headless runtime and toolbar are framework-independent. React is an optional
entry point and is not included by `slowmo` or `slowmo/toolbar`.

## Headless

The convenience API activates lazily on its first command:

```js
import slowmo from "slowmo";

slowmo(0.5);
slowmo.pause();
slowmo.play();
slowmo.reset();
slowmo.destroy(); // restore native timing
```

Use a controller when your UI should own an explicit lifecycle:

```js
import { createSlowmoController } from "slowmo";

const controller = createSlowmoController();

controller.setSpeed(0.5);
controller.subscribe(({ status, speed, paused }) => {
  console.log({ status, speed, paused });
});

controller.destroy();
```

Importing `slowmo` does not patch the page. `activate()` or the first playback
command acquires the shared runtime; `destroy()` releases it. The last owner
restores the timing functions and controlled playback rates it owns.

## Toolbar

```js
import { createSlowmoToolbar } from "slowmo/toolbar";

const toolbar = createSlowmoToolbar({
  defaultPlacement: "bottom-left",
  shortcut: "Mod+Shift+S",
});

toolbar.close();
toolbar.open();
toolbar.toggle();
toolbar.reset();
toolbar.destroy();
```

The toolbar:

- Scrubs through power-of-two presets from 1/64× through 32× and ∞.
- Supports arrow-key stepping, Home for 1×, and End for ∞.
- Pauses and resumes at the selected speed.
- Returns to 1× on double-click.
- Drags, docks, rotates at side edges, and accounts for page scrollbars.
- Can start at a semantic placement or relative to an anchor element.
- Follows system light/dark appearance.
- Persists placement and orientation by default, but not speed or visibility.
- Fully deactivates its timing session when closed.
- Reopens at 1×.

To start below content until the user drags it:

```js
createSlowmoToolbar({
  anchor: document.querySelector("#debug-tools"),
  anchorSide: "bottom",
  anchorGap: 8,
});
```

The original `slowmo/dial` API remains as a compatibility alias.

## React Component

Use the shared toolbar directly:

```jsx
import { SlowmoToolbar } from "slowmo/react";

export function DebugTools() {
  return (
    <SlowmoToolbar
      defaultPlacement="bottom-left"
      shortcut="Mod+Shift+S"
    />
  );
}
```

Or build a custom React component with the headless hook:

```jsx
import { useSlowmo } from "slowmo/react";

export function PlaybackControls() {
  const { speed, setSpeed, pause, reset } = useSlowmo();

  return (
    <div>
      <output>{speed}×</output>
      <button onClick={() => setSpeed(0.5)}>Slow down</button>
      <button onClick={pause}>Pause</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

`useSlowmoController()` and `useSlowmoSnapshot(controller)` are also exported
for shared-controller and external-store integrations. The old `<Slowmo />`
name remains as a deprecated alias for `<SlowmoToolbar />`.

Copyable source files for all three integration modes live in
[`examples/`](./examples/).

## Toolbar options

| Option | Default | Purpose |
|---|---|---|
| `defaultOpen` | `true` | Open immediately when the host mounts |
| `defaultPlacement` | `"bottom-right"` | Semantic or percentage-based start |
| `anchor` | — | Element to follow until the first drag |
| `anchorSide` | `"bottom"` | Side of the anchor |
| `anchorGap` | `12` | Gap from the anchor in pixels |
| `shortcut` | `"Mod+Shift+S"` | Page shortcut, or `false` |
| `persistence` | local storage | Replaceable adapter, or `false` |
| `mountTarget` | `document.body` | DOM target for the toolbar host |
| `controller` | new controller | Share an existing headless controller |

## Chrome extension behavior

- Nothing is injected until the toolbar icon or assigned shortcut is used.
- Activation applies to the current tab and its eligible frame tree.
- Close removes the toolbar and restores Slowmo-owned timing effects in every
  injected frame.
- Re-triggering opens a clean session at 1×.
- Reloading or navigating creates an inactive document.
- Tabs are independent.
- Placement and orientation are stored by the extension and shared across
  sites.
- The shortcut is remappable at `chrome://extensions/shortcuts`.

The suggested shortcut is `Command+Shift+S` on macOS and `Ctrl+Shift+S`
elsewhere. Chrome and operating-system shortcuts take priority.

## Excluding elements

Mark UI that should continue at wall-clock speed:

```html
<div data-slowmo-exclude>This animation is unaffected.</div>
```

The shared toolbar already carries this marker.

For JavaScript-owned UI delays, use the native wall-clock timer facade:

```js
import { getSlowmoWallClock } from "slowmo";

const wallClock = getSlowmoWallClock();
wallClock.setTimeout(showTooltip, 600);
```

## What it controls

| Type | Mechanism |
|---|---|
| CSS animations and transitions | Web Animations `playbackRate` |
| Web Animations API | `Animation.playbackRate` |
| Video and audio | Media `playbackRate` |
| `requestAnimationFrame` | Virtual callback timestamps |
| `performance.now()` and `Date.now()` | Virtual clocks |
| `setTimeout()` and `setInterval()` | Scaled delays at scheduling time |
| GSAP | Global timeline time scale |

## Limitations

- A callback that already fired, a finished animation, or a media seek cannot be
  reversed during teardown.
- Existing scheduled timers retain the delay chosen when they were created.
- Video/audio rates are clamped to browser-supported ranges.
- Service workers and worklets have separate clocks and are not patched.
- Custom server clocks and WebGL shader uniforms require explicit integration.

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local development and
[docs/RELEASING.md](./docs/RELEASING.md) for npm, website, and Chrome release
steps.

[website](https://slowmo.dev) · [github](https://github.com/seflless/slowmo) · [npm](https://www.npmjs.com/package/slowmo)

## License

MIT
