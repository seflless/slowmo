# slowmo

A tiny, universal slow-motion library for web animations.

## Project Goals

1. **Dead simple API** - `slowmo(0.5)` slows everything to half speed
2. **Universal** - Works with CSS animations, videos, GSAP, Three.js, Framer Motion, canvas, etc.
3. **Zero config** - Drop it in, it just works
4. **Lightweight** - No dependencies, small bundle size
5. **Beautiful demo** - Showcase page with impressive examples

## Use Cases

- Debug animations by slowing them down
- Record product demos in slow-mo
- Create dramatic slow-motion effects
- Inspect animation details frame-by-frame

## Tech Stack

- TypeScript
- Vite (build + dev server)
- Vitest (tests)
- MIT License

## Commands

- `npm run dev` - Run demo page
- `npm run build` - Build library
- `npm test` - Run unit tests
- `npm run test:e2e` - Run E2E tests
- `npm run test:all` - Run all tests
- `npm run typecheck` - TypeScript check

## Publishing

- `npm run release:patch` - Bump patch version + publish
- `npm run release:minor` - Bump minor version + publish
- `npm run release:major` - Bump major version + publish

## Package Exports

| Import | Description |
|--------|-------------|
| `slowmo` | Core speed control API |
| `slowmo/dial` | Vanilla JS dial component |
| `slowmo/react` | React `<Slowmo />` component |
| `slowmo/recreate` | AI animation recreation |
