# slowmo recreate - Specification

## Overview

`slowmo recreate` is a CLI tool that takes a video recording of a UI interaction and produces working code that recreates it. The tool uses AI (Gemini/OpenAI/Anthropic) to analyze the video frames and generate HTML/CSS/JS that replicates the recorded experience.

## Core Value Proposition

**Input:** A video/GIF of a UI moment (button click, panel animation, hover effect, etc.)

**Output:**
1. Working, self-contained vanilla HTML/CSS/JS code
2. A demo page proving the recreation works (Before vs After comparison)

## Current State

### What Exists

- `src/recreate.ts` - Core module with AI integration (Gemini, OpenAI, Anthropic)
- `src/cli/recreate.ts` - CLI interface
- `src/cli/index.ts` - Main CLI entry point (`slowmo recreate <video>`)
- Frame extraction via ffmpeg
- Basic demo generation

### What's Broken

1. **AI output parsing fails** - The AI often returns a full HTML document instead of the expected JSON with separate `code`, `html`, `javascript` fields. Fallback parsing exists but doesn't work reliably.

2. **Demo page issues:**
   - Video gets clipped (CSS max-height issue)
   - "After" panel often empty (HTML not extracted/rendered)
   - Code display is one blob instead of organized files

3. **Recreation quality** - The AI doesn't reliably capture the visual design or animation details from the video.

## Target Architecture

### CLI Usage

```bash
# Basic usage - generates demo.html
slowmo recreate video.mp4 -o demo.html

# With options
slowmo recreate video.mp4 --demo --verbose -o output.html

# Different runtimes (future)
slowmo recreate video.mp4 -r framer-motion  # React output
slowmo recreate video.mp4 -r css            # Vanilla (default)
```

### Demo Page Requirements

The generated demo HTML should have:

1. **Header**
   - Title: "Recreation Demo"
   - Description from AI analysis

2. **Comparison Section**
   - Left: Original video (full size, not clipped, with controls)
   - Right: Working recreation (interactive, clickable)

3. **Code Section**
   - Tabs: HTML | CSS | JS
   - Copy button per tab
   - Download ZIP button (all files)

4. **The recreation must actually work** - clicking buttons should trigger animations, etc.

### Output Structure

When generating code, produce three separate files conceptually:

```
index.html   - The HTML structure
styles.css   - All CSS including animations
script.js    - Event handlers and interaction logic
```

For the demo, these are embedded. The Download ZIP should contain these as separate files.

## AI Prompting Strategy

### Analysis Phase

The AI receives ~60 frames from the video and should identify:

1. **UI Elements** - buttons, cards, panels, inputs, etc.
2. **Interactions** - clicks, hovers visible in the recording
3. **Animation Properties** - what animates, timing, easing
4. **Visual Design** - colors (exact hex), border radius, shadows, spacing

### Code Generation Phase

The AI receives the analysis and should produce:

```json
{
  "html": "<div class=\"container\">...</div>",
  "css": ".container { ... } @keyframes { ... }",
  "javascript": "document.querySelector('.btn').addEventListener('click', ...)",
  "description": "A button that shows/hides a panel with a fade animation"
}
```

**Critical:** The AI must NOT return a full HTML document. It must return this JSON structure with separate fields.

## Key Files to Modify

### `src/recreate.ts`

- `buildAnalysisPrompt()` - Line ~836 - Improve UI element detection
- `buildCodeGenerationPrompt()` - Line ~916 - Enforce JSON output format
- Code parsing section - Line ~1009 - Better fallback when AI ignores format

### `src/cli/recreate.ts`

- `generateInteractiveDemo()` - Line ~441 - Fix video clipping, empty preview
- Add tabbed code display
- Add download ZIP functionality

## Test Cases

Use these videos to validate:

1. **Simple animation** - A circle that grows (no interaction)
2. **Interactive component** - Button that shows/hides a panel (`~/Desktop/hide-show.mp4`)
3. **Hover effect** - Element that changes on hover

## Success Criteria

1. Original video displays fully (not clipped)
2. Recreation appears in "After" panel and matches original visually
3. Recreation is interactive (clicks work)
4. Code is displayed in tabs (HTML/CSS/JS)
5. Download ZIP works
6. Copy buttons work per file

## Non-Goals (for now)

- React/Framer Motion output (keep vanilla first)
- Complex multi-step interactions
- Scroll-based animations
- 3D/WebGL

## Running the Tool

```bash
# From repo root
cd /Users/francoislaberge/conductor/workspaces/slowmo/hanoi-v1

# Run from source
GEMINI_API_KEY=your-key bun slowmo recreate ~/Desktop/hide-show.mp4 -r css --demo --verbose -o /tmp/demo.html

# Open result
open /tmp/demo.html
```

## Environment

- Node/Bun
- TypeScript
- ffmpeg/ffprobe required for frame extraction
- API key needed: GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY
