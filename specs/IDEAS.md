# Future Ideas

## Frame Throttling Mode

For animations that use frame-based updates (fixed increment per rAF callback rather than time-based), the timestamp manipulation approach doesn't work.

A potential solution: **frame throttling mode** that reduces the frequency of rAF callbacks.

```js
slowmo.setMode('throttle'); // Enable frame throttling
slowmo.setSpeed(0.5);       // Call callbacks at half the normal rate
```

**How it would work:**
- Track the normal frame rate (e.g., 60fps)
- At 0.5x speed, only call the callback every other frame
- At 0.25x speed, call every 4th frame
- For speeds > 1x, we'd need to call multiple times per frame (tricky)

**Tradeoffs:**
- Makes animations choppy (lower effective fps)
- Affects ALL rAF animations, including time-based ones that would otherwise be smooth
- Only supports discrete speed levels (1/2, 1/3, 1/4, etc.)

**When to use:**
- Debugging frame-based animations
- When smoothness doesn't matter
- Recording at lower frame rates

This would be opt-in and clearly documented as a different mode with different tradeoffs.

## Other Ideas

### GSAP Deep Integration
- Auto-detect GSAP and use its native `gsap.globalTimeline.timeScale()`
- Handle GSAP's own ticker

### Three.js Clock Integration
- Patch `THREE.Clock` to use our virtual time
- Would make Three.js animations work seamlessly

### Lottie Support
- Lottie has its own animation speed controls
- Could auto-detect and integrate

### Browser Extension
- Package slowmo as a browser extension
- Inject into any page for debugging/recording
- UI overlay for controlling speed

### Recording Helper
- Integration with screen recording
- Automatically slow down, record, then speed up the video in post
