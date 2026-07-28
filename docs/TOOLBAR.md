# Toolbar

`slowmo/toolbar` is the canonical, framework-independent toolbar. The React
component and Chrome extension both adapt this implementation.

```ts
import { createSlowmoToolbar } from "slowmo/toolbar";

const toolbar = createSlowmoToolbar({
  defaultPlacement: "bottom-center",
  shortcut: "Mod+Shift+S",
});
```

## Lifecycle

| State | UI | Timing |
|---|---|---|
| Dormant | Absent | Native |
| Active | Visible | Slowmo controller active |
| Closing | Leaving | Already restored |
| Destroyed | Absent | Native; shortcut removed |

`close()` leaves the host available for a shortcut or later `open()`.
`destroy()` removes the host and its keyboard listener permanently.

## API

```ts
toolbar.open();
toolbar.close();
toolbar.toggle();
toolbar.reset();
toolbar.update({ shortcut: "Mod+Shift+D" });
toolbar.isOpen();
toolbar.getElement();
toolbar.destroy();
```

## Placement

Semantic placements are:

```ts
"top-left" | "top-center" | "top-right"
| "left" | "center" | "right"
| "bottom-left" | "bottom-center" | "bottom-right"
```

Percentage placement is also supported:

```ts
createSlowmoToolbar({
  defaultPlacement: { xPct: 0.25, yPct: 0.8 },
});
```

An anchor follows content until the first drag:

```ts
createSlowmoToolbar({
  anchor: document.querySelector("#try-it"),
  anchorSide: "bottom",
  anchorGap: 8,
});
```

After dragging, the toolbar becomes viewport-relative and persists its docking
state.

## Persistence

The default adapter uses origin-scoped local storage and saves only:

- Percentage position
- Dock edge
- Horizontal/vertical orientation

Speed and visibility intentionally start clean. Disable or replace persistence:

```ts
createSlowmoToolbar({ persistence: false });

createSlowmoToolbar({
  persistence: {
    load: () => savedPlacement,
    save: (placement) => savePlacement(placement),
  },
});
```

## Shortcut

The default embedded shortcut is `Mod+Shift+S`, where `Mod` means Command on
Apple platforms and Control elsewhere. Editable fields are ignored. Set
`shortcut: false` to disable the page listener.

Chrome extension shortcuts use Chrome's commands system instead of this page
listener.

When the speed control is focused, arrow keys step through presets, Home
returns to 1×, and End selects ∞.

## React

```tsx
import { SlowmoToolbar } from "slowmo/react";

<SlowmoToolbar
  defaultPlacement="bottom-left"
  defaultOpen={false}
  shortcut="Mod+Shift+S"
/>;
```

The component creates the vanilla host in an effect and fully destroys it on
unmount. It is safe under React Strict Mode.

For custom controls:

```tsx
import { useSlowmo } from "slowmo/react";

function Controls() {
  const { speed, setSpeed, pause, reset } = useSlowmo();
  // Render controls that match your product.
}
```

Advanced integrations can compose `useSlowmoController()` and
`useSlowmoSnapshot(controller)`.
