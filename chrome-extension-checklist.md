# Chrome Extension Publishing Checklist

## Developer Account
- [x] Chrome Web Store Developer Account ($5 one-time fee)

## Extension Files
- [x] manifest.json (Manifest V3)
- [x] Icons: 16x16, 48x48, 128x128 PNG
- [x] Background action handler
- [x] content.js
- [x] Create ZIP package (`slowmo-extension.zip`)

## Test Locally

1. Build the extension bundle:

   ```bash
   bun run build:ext
   ```

2. Open `chrome://extensions`, enable **Developer mode**, and choose
   **Load unpacked**.
3. Select this repository's `extension/` directory. If it is already loaded,
   click its **Reload** button instead.
4. Open or reload a normal webpage and verify:
   - The toolbar appears once in the top-level page.
   - Pause/play controls the page.
   - Horizontal scrubbing changes speed and double-click returns to 1×.
   - Dragging docks the toolbar and rotates it at the left/right edges.
   - Light and dark system appearances both render correctly.
   - Close restores 1× and removes the toolbar.
   - Clicking the Slowmo extension icon restores the toolbar in the active tab.
   - Reloading or navigating creates the toolbar again for the new page.

Chrome does not inject extensions into internal pages such as
`chrome://extensions` or the Chrome Web Store itself.

## Publish an Update

1. Increase `version` in `extension/manifest.json`. The Chrome Web Store
   rejects a package whose version is not higher than the published version.
2. Run the final checks and rebuild:

   ```bash
   bun run test
   bun run typecheck
   bun run build:ext
   ```

3. Create the upload package:

   ```bash
   bun run zip:extension
   ```

4. Upload `slowmo-extension.zip` to the existing item in the Chrome Web Store
   Developer Dashboard, complete the review prompts, and submit the update.

The version in `package.json` is the npm library version. It does not need to
change for an extension-only release. Bump it separately when publishing the
library to npm.

## Store Listing Assets

### Screenshots (required, 1-5 images, 1280x800 or 640x400 PNG)

**Shot 1: Hero Shot - Toolbar in Action**
- Show the Slowmo toolbar floating over a visually interesting website (e.g., an animation-heavy landing page or video player)
- The toolbar should be at a visibly slow speed
- Caption: "Control time on any webpage"

**Shot 2: Speed Control Demo**
- Split view or sequence showing the toolbar at different speeds
- Show the fraction/whole-number speed readout clearly
- Caption: "Power-of-two presets from 1/64× to instant"

**Shot 3: Video Slowdown**
- YouTube or video player with the toolbar visible
- Show the toolbar at a slow speed
- Caption: "Slow down videos for analysis"

**Shot 4: Animation Debugging**
- Developer-focused: show a site with CSS animations
- DevTools open alongside the toolbar
- Caption: "Debug animations frame by frame"

**Shot 5: Pause Feature**
- Show the toolbar in its paused state (play icon visible)
- Caption: "Pause everything instantly"

### Small Promo Tile (optional, 440x280 PNG)
- Dark background (#1c1917 to match extension)
- Slowmo toolbar graphic centered
- "slowmo" text below
- Tagline: "Control time on any webpage"

### Marquee (optional, 1400x560 PNG)
- Same dark theme
- Larger toolbar graphic on left
- Right side: "slowmo" + tagline + feature bullets

## Privacy Policy
- [x] Create privacy policy page (`demo/privacy-policy.html`)
- [ ] Deploy to slowmo.dev/privacy-policy (push to main + Vercel deploy)

### Privacy Policy Content

```
Privacy Policy for slowmo Chrome Extension

Last updated: February 2025

slowmo is a browser extension that controls animation and video playback speed on web pages.

Data Collection
slowmo does NOT collect, store, or transmit any personal data. The extension:
- Does not track your browsing history
- Does not collect analytics or usage data
- Does not use cookies
- Does not communicate with any external servers
- Does not access or store any personal information

Local Storage
The extension stores only one piece of data locally on your device:
- Toolbar position, orientation, and selected speed

This data never leaves your browser.

Permissions
The extension requests these permissions:
- "activeTab" and "scripting": To inject the slowmo script into web pages
- "<all_urls>": To work on any website you visit

These permissions are used solely to modify animation timing on the current page. No data is collected or transmitted.

Contact
For questions about this privacy policy, visit https://github.com/seflless/slowmo

Changes
Any changes to this policy will be posted on this page.
```

## Store Listing Info
- [ ] Submit listing

### Title
slowmo

### Summary (132 characters max)
Control time on any web page. Slow down or speed up animations, videos, and games.

### Description
```
slowmo lets you control time on any website.

FEATURES
• Slow down animations to 1/64x speed for frame-by-frame inspection
• Speed up to 32x or jump instantly to the end
• Works with CSS animations, videos, canvas games, GSAP, Three.js, and more
• Pause everything instantly with one click
• Compact playback toolbar that stays out of your way
• Drag to reposition and dock it to any edge
• Works across iframes automatically

USE CASES
• Debug animations - see exactly what's happening at each frame
• Record product demos - capture smooth slow-motion footage
• Analyze videos - slow down tutorials, sports, or techniques
• Speed through content - fast-forward long videos or animations
• Create dramatic effects - add cinematic slow-mo to any page

HOW TO USE
1. Click the left side to pause/play
2. Drag the speed readout horizontally through the speed presets
3. Drag the divider to reposition and dock the toolbar
4. Double-click the speed readout to return to 1×
5. Hover and use Close to remove it; click the extension icon to restore it

The toolbar appears in the bottom-right corner of every page. Your position, orientation, and speed preferences are saved automatically.

OPEN SOURCE
slowmo is free and open source. View the code and report issues at:
https://github.com/seflless/slowmo

Also available as an npm package for developers:
https://www.npmjs.com/package/slowmo
```

### Category
Developer Tools

### Language
English

## Final Steps
- [ ] Upload ZIP to Chrome Web Store Developer Console
- [ ] Fill in listing details
- [ ] Upload screenshots
- [ ] Add privacy policy URL
- [ ] Submit for review
