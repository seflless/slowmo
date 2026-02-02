# Chrome Extension Publishing Checklist

## Developer Account
- [x] Chrome Web Store Developer Account ($5 one-time fee)

## Extension Files
- [x] manifest.json (Manifest V3)
- [x] Icons: 16x16, 48x48, 128x128 PNG
- [x] popup.html
- [x] content.js
- [x] Create ZIP package (`slowmo-extension.zip`)

## Store Listing Assets

### Screenshots (required, 1-5 images, 1280x800 or 640x400 PNG)

**Shot 1: Hero Shot - Dial in Action**
- Show the slowmo dial floating over a visually interesting website (e.g., an animation-heavy landing page or video player)
- Dial should be at 0.25x or 0.5x speed
- Caption: "Control time on any webpage"

**Shot 2: Speed Control Demo**
- Split view or sequence showing the dial at different speeds (0.1x, 1x, 5x)
- Show the speed readout clearly
- Caption: "From 1/60x to 10x speed"

**Shot 3: Video Slowdown**
- YouTube or video player with dial visible
- Show dial at slow speed (0.25x)
- Caption: "Slow down videos for analysis"

**Shot 4: Animation Debugging**
- Developer-focused: show a site with CSS animations
- DevTools open alongside the dial
- Caption: "Debug animations frame by frame"

**Shot 5: Pause Feature**
- Show the dial in paused state (play icon visible)
- Caption: "Pause everything instantly"

### Small Promo Tile (optional, 440x280 PNG)
- Dark background (#1c1917 to match extension)
- Slowmo dial graphic centered
- "slowmo" text below
- Tagline: "Control time on any webpage"

### Marquee (optional, 1400x560 PNG)
- Same dark theme
- Larger dial graphic on left
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
- The position of the slowmo dial on screen (so it remembers where you placed it)

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
• Slow down animations to 1/60x speed for frame-by-frame inspection
• Speed up to 10x for fast-forwarding through content
• Works with CSS animations, videos, canvas games, GSAP, Three.js, and more
• Pause everything instantly with one click
• Beautiful rotary dial interface that stays out of your way
• Drag to reposition anywhere on screen
• Works across iframes automatically

USE CASES
• Debug animations - see exactly what's happening at each frame
• Record product demos - capture smooth slow-motion footage
• Analyze videos - slow down tutorials, sports, or techniques
• Speed through content - fast-forward long videos or animations
• Create dramatic effects - add cinematic slow-mo to any page

HOW TO USE
1. Click the dial to pause/play
2. Drag the outer ring to adjust speed
3. Drag the center to reposition

The dial appears in the bottom-right corner of every page. Your position preference is saved automatically.

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
