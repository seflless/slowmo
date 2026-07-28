# Headless API

The root `slowmo` entry point contains no toolbar or React dependency. Importing
it does not change browser globals.

## Convenience singleton

```ts
import slowmo from "slowmo";

slowmo(0.5);
slowmo.pause();
slowmo.play();
slowmo.reset();
slowmo.destroy();
```

The first playback command activates the default controller. `play()` returns
to the last non-zero finite speed. `destroy()` releases the controller and
returns its snapshot to `{ status: "inactive", speed: 1, paused: false }`.

## Explicit controller

```ts
import { createSlowmoController } from "slowmo";

const controller = createSlowmoController();
const unsubscribe = controller.subscribe(console.log);

controller.activate();
controller.setSpeed(0.25);
controller.pause();
controller.play();
controller.reset();

unsubscribe();
controller.destroy();
```

Controllers in one JavaScript realm share a versioned runtime. Each controller
owns a lease:

- The first owner captures and patches timing APIs.
- Later owners reuse that runtime rather than wrapping wrappers.
- Destroying one owner does not tear down another owner.
- Destroying the last owner cancels polling and restores captured functions and
  live playback rates.

## Snapshot

```ts
interface SlowmoSnapshot {
  status: "inactive" | "active";
  speed: number;
  paused: boolean;
}
```

Subscribe through the controller rather than polling `getSpeed()` when building
custom controls.

## Exclusions

`data-slowmo-exclude` opts an element and its composed-tree descendants out of
Web Animation and media rate changes:

```html
<aside data-slowmo-exclude>Debug UI</aside>
```

JavaScript timing functions are realm-wide, so the marker cannot selectively
exclude arbitrary JavaScript callbacks. UI code that must keep real time can
use the native timer facade:

```ts
import { getSlowmoWallClock } from "slowmo";

const wallClock = getSlowmoWallClock();
const timer = wallClock.setTimeout(showTooltip, 600);
wallClock.clearTimeout(timer);
```

## Teardown boundary

Teardown restores future timing behavior and live objects Slowmo still controls.
It cannot undo already-fired callbacks, completed animations, or media seeks.
Timers created while Slowmo was active retain their scheduled native delay.
