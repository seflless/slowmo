# Chrome Extension

## User-facing lifecycle

1. Install and pin Slowmo if desired.
2. Visit a normal web page.
3. Click the Slowmo toolbar icon or use the assigned shortcut.
4. Slowmo activates in the current tab and shows one top-frame toolbar.
5. Close ends that session and restores Slowmo-owned timing effects.
6. Trigger the extension again to start a fresh session at 1×.

Reloading or navigating does not reactivate Slowmo. Other tabs are independent.
Chrome blocks extension injection on internal pages and the Chrome Web Store.
Slowmo marks its toolbar icon with `!` and an explanatory title when that
happens.

The suggested shortcut is Command+Shift+S on macOS and Ctrl+Shift+S elsewhere.
Change it at `chrome://extensions/shortcuts`.

## Architecture

The background service worker injects two generated bundles only after a user
invocation:

- `runtime.js` enters the main world of all eligible frames. It owns timing
  patches and frame synchronization.
- `toolbar.js` enters the top frame's isolated world. It mounts the shared
  toolbar and uses extension storage.

The isolated toolbar applies commands immediately to the top main-world bridge
and reports the same primitive command to the background service worker. Chrome
then fans the command out to every eligible frame, including cross-origin
frames. When a child frame appears during an active session, the service worker
injects its runtime and reads the current speed from the top frame before
synchronizing the child.

Placement and orientation use `chrome.storage.local`. Active-tab session
bookkeeping uses `chrome.storage.session` and is cleared on close, reload,
navigation, or tab removal. Speed is read live from the page and is not stored.
Each activation has a fresh session token, so delayed cleanup from an older
toolbar cannot tear down a newly triggered session.

## Local test

```bash
bun run build:ext
bun run test:e2e:extension
```

For visual testing:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked and select `extension/`.
4. After source changes, run `bun run build:ext` and click Reload on the
   extension card.
5. Reload the test page only to load your latest page code. The extension
   itself should remain inactive until triggered.

Use `http://localhost:5174/tests/fixtures/iframe-test-page.html` while
`vite --config vite.test.config.ts` is running.
