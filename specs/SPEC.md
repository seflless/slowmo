# Slowmo Specification

## Product surfaces

Slowmo has three delivery modes backed by one timing runtime and one toolbar:

| Surface | Entry point | Purpose |
|---|---|---|
| Headless | `slowmo` | Custom UI and direct programmatic control |
| Embedded toolbar | `slowmo/toolbar`, `slowmo/react` | Product-integrated debugging tool |
| Chrome extension | Generated extension bundles | On-demand control of arbitrary pages |

Neither the timing runtime nor toolbar depends on React. The React entry point
is an optional adapter.

## Headless lifecycle

- Importing `slowmo` MUST NOT patch the page.
- `activate()` or the first playback command MUST acquire the shared runtime.
- The first owner in a realm MUST capture native timing functions exactly once.
- Later owners MUST reuse the runtime rather than patching wrappers.
- `destroy()` MUST be idempotent.
- The last owner to call `destroy()` MUST:
  - Restore captured timing function identities.
  - Cancel Slowmo's polling request.
  - Restore live Web Animation and media playback rates.
  - Resume only objects paused by Slowmo.
  - Reset the controller snapshot to inactive 1×.

```ts
interface SlowmoSnapshot {
  status: "inactive" | "active";
  speed: number;
  paused: boolean;
}
```

`play()` resumes the most recent non-zero finite speed or 1×.

## Toolbar lifecycle

The canonical toolbar is `createSlowmoToolbar()`.

- Default placement is bottom-right.
- Default embedded shortcut is `Mod+Shift+S`.
- Close MUST deactivate the toolbar's controller before removing the UI.
- Close MUST leave the host available for `open()` or its shortcut.
- Destroy MUST also remove the host shortcut and other listeners.
- Open after Close MUST start at 1×.
- Placement and orientation persist by default.
- Speed and open/closed state do not persist by default.
- Persistence is replaceable or disableable.
- The toolbar MUST remain above page content and account for classic page
  scrollbars.
- Dragging to a side edge rotates the toolbar vertically.
- An element-relative anchor follows its element until the first drag.

Presets:

`1/64×`, `1/32×`, `1/16×`, `1/8×`, `1/4×`, `1/2×`, `1×`, `2×`, `4×`,
`8×`, `16×`, `32×`, `∞`.

The speed scrub has a sticky 1× stop and double-click resets to 1×.

## React

- `<SlowmoToolbar />` MUST mount the canonical vanilla toolbar.
- React Strict Mode MUST NOT leave duplicate hosts, controllers, or listeners.
- Unmount MUST destroy resources owned by the component.
- `useSlowmo()` provides a headless custom-control API.
- `useSlowmoController()` and `useSlowmoSnapshot()` support advanced
  composition.
- `<Slowmo />` remains a deprecated compatibility alias.

## Chrome extension

- The manifest MUST NOT statically inject Slowmo into every page.
- The action and `_execute_action` command MUST use the same activation
  boundary.
- Activation injects the runtime into all eligible frames and the toolbar only
  into the top frame.
- Main-world timing code and the isolated-world toolbar communicate through the
  extension protocol.
- Newly committed child frames receive the runtime while the tab session is
  active.
- Close deactivates every injected frame and clears active-tab bookkeeping.
- Reload, top-level navigation, and tab removal clear the session.
- Re-trigger starts at 1×.
- Tabs are independent.
- Extension placement/orientation use extension-owned local storage.

## Exclusions

Elements carrying `data-slowmo-exclude`, including composed-tree ancestors,
retain their Web Animation and media playback rates. Realm-wide JavaScript
clock patches cannot be excluded per element.

## Controlled mechanisms

| Mechanism | Behavior |
|---|---|
| CSS/Web Animations | Multiply developer playback rate |
| Video/audio | Multiply and clamp playback rate |
| `requestAnimationFrame` | Pass a virtual timestamp |
| `performance.now()` | Return virtual monotonic time |
| `Date.now()` | Return virtual epoch time |
| Timers | Scale delay when scheduled |
| GSAP | Set and later restore global timeline scale |

Infinity finishes finite animations and media when possible. Those completed
effects cannot be reversed on teardown.

## Demo

The single-page website MUST include deep-linkable sections for:

- Try It
- Animation demos
- Headless API
- React Component

The demo toolbar starts centered below “Try It,” follows that anchor until
dragged, and then behaves like the normal floating toolbar. Landing-page chrome
uses `data-slowmo-exclude` so its own reveal/navigation motion remains usable at
very slow speeds.

The demo uses a local looping video and bundled Motion dependency.

## Release gates

- Unit tests for controller, toolbar, React, and extension action boundaries
- Browser tests for animation mechanisms
- Real unpacked-extension tests for inactive, activate, frame sync, close,
  reopen, reload, and dynamic frames
- Typecheck and all package/demo/extension builds
- npm package content inspection
- Exact Chrome ZIP inspection and unpacked smoke test
