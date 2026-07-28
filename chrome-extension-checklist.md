# Chrome Extension Publishing Checklist

## Build and automated verification

- [ ] `bun run typecheck`
- [ ] `bun run test:unit`
- [ ] `bun run test:e2e`
- [ ] `bun run test:e2e:extension`
- [ ] `bun run build:ext`
- [ ] `bun run zip:extension`
- [ ] Confirm `manifest.json`, `background.js`, `runtime.js`, and `toolbar.js`
      are at the ZIP root

## Load unpacked

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked and select `extension/`.
4. For later changes, rebuild and click Reload on the extension card.

Verify:

- [ ] A normal page is untouched before the extension is triggered
- [ ] Icon and assigned shortcut activate the already-open tab
- [ ] Exactly one toolbar appears
- [ ] Scrubbing, pause/play, double-click 1×, dragging, docking, and side
      orientation work
- [ ] Page-level scrollbars do not cover the toolbar
- [ ] Close immediately returns live animations/media to their developer rates,
      restores native timing hooks, and removes the toolbar
- [ ] Triggering again starts at 1×
- [ ] Reloading or navigating is inactive
- [ ] Two tabs remain independent
- [ ] Same-origin, cross-origin, nested, and dynamically created frames sync
- [ ] Strict Trusted Types pages render the toolbar
- [ ] Light and dark system appearances render correctly
- [ ] Chrome internal pages and the Web Store stay inactive and show `!`

## Publish an update

1. Increase `version` in `extension/manifest.json`. Chrome requires every
   uploaded version to be greater than the published version.
2. Run every check above.
3. Upload `slowmo-extension.zip` to the existing item in the Chrome Web Store
   Developer Dashboard.
4. Update listing and privacy declarations if permissions or behavior changed.
5. Submit for review. Choose deferred publishing if coordinating the release.

The extension manifest version is independent from the npm version.

## Store listing copy

### Summary

Control time on any web page. Slow down or speed up animations, videos, and games.

### Behavior

Slowmo is inactive until you click its toolbar icon or use its assigned
shortcut. It then controls the current tab and its embedded frames. Closing the
toolbar fully ends that page session; triggering it again starts at 1×.

### Features

- Power-of-two presets from 1/64× to 32× and instant completion
- Pause and resume
- Draggable, dockable toolbar with light and dark appearance
- Current-tab iframe synchronization
- Clean close and reactivation lifecycle
- Remappable Chrome shortcut

## Privacy

Slowmo does not collect or transmit browsing or personal data. It uses:

- `activeTab` and `scripting` to activate after a user invocation
- `host_permissions` to reach eligible embedded frames
- `webNavigation` to activate dynamically created frames during an active tab
  session
- `storage.local` for toolbar placement and orientation
- `storage.session` for temporary active-tab bookkeeping

No speed, browsing history, analytics, or page content is stored.

## Listing assets

- [ ] 1280×800 or 640×400 hero screenshot
- [ ] Speed preset screenshot
- [ ] Video slowdown screenshot
- [ ] Animation debugging screenshot
- [ ] Pause screenshot
- [ ] Privacy policy deployed at `slowmo.dev/privacy-policy`
- [ ] Listing copy updated
- [ ] Package uploaded and submitted
