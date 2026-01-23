# MVP: Basic Website and README

## Goal

Ship a polished open source release with:
1. **README** - Shows up on GitHub + npm. Focus: why, value, quick start
2. **Website** - Hosted on Vercel. Focus: interactive demos, docs

## Requirements

### README

- **Lead with value**: "Slow down any animation with one line of code"
- **Quick visual hook**: GIF or video showing slow-motion effect (you'll record this)
- **Installation**: npm/pnpm/yarn + CDN
- **Minimal example**: 3 lines max
- **What it works with**: CSS animations, videos, GSAP, Three.js, Framer Motion, canvas
- **API reference**: Brief, link to website for full docs
- **Link to website**: Prominent

### Website

- **Vite-based** (already is)
- **Vercel compatible**: Static build to `dist-demo`, no server-side
- **Single page** is fine for MVP, structure so we can add pages later
- **Sections**:
  - Hero: Name, tagline, speed slider, live demo preview
  - Installation: Copy-paste commands
  - Examples: Interactive cards showing different animation types
  - API: Basic reference
  - Footer: GitHub link, npm link

### Vercel Compatibility

- `vercel.json` or use Vite's default static output
- Build command: `npm run build:demo`
- Output dir: `dist-demo`
- No server functions needed

---

## Plan

### Stage 1: README

**Work:**
- Create `README.md` with:
  - Tagline + value prop
  - Install commands (npm, pnpm, yarn, CDN)
  - Quick start (3-line example)
  - "What it works with" section
  - Brief API reference
  - Links to website (placeholder URL for now)
  - License badge

**Validation:**
- Review README renders correctly
- All code examples are accurate

---

### Stage 2: Website Hero + Controls

**Work:**
- Refactor `demo/index.html` → proper website structure
- Create `demo/index.html` as marketing site (not just demo)
- Hero section: Big tagline, speed slider that affects all demos below
- Better styling: Cleaner, more marketing-focused
- Keep existing demo cards but improve layout

**Validation:**
- `npm run dev` shows improved site
- Speed slider works across all demos

---

### Stage 3: Website Polish + Install Section

**Work:**
- Add installation section with copy buttons
- Add API reference section
- Add footer with links
- Responsive design improvements
- Better typography and spacing

**Validation:**
- Site looks good on mobile and desktop
- Install commands are correct

---

### Stage 4: Vercel Deployment Setup

**Work:**
- Add `vercel.json` for static deployment
- Update `vite.demo.config.ts` if needed for clean URLs
- Add build script tweaks if needed
- Update README with actual website URL (once you deploy)

**Validation:**
- `npm run build:demo` produces `dist-demo` folder
- Folder works when served locally (`npx serve dist-demo`)

---

## Decisions

1. **Website URL**: TBD - use placeholder in README, update after Vercel deploy
2. **Video/GIF**: Store in repo (e.g., `assets/` or `demo/assets/`). Already excluded from npm via `files: ["dist"]`
3. **Package name**: `slowmo` is available on npm - using that
4. **Analytics**: Not needed for MVP

---

## Non-Goals (for MVP)

- Multi-page routing
- Full documentation site
- Blog
- Examples page (beyond what's on home page)
- SSR/SSG frameworks (stick with plain Vite)
