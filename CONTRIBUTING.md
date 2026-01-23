# Contributing to slowmo

Thanks for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/seflless/slowmo.git
cd slowmo
npm install
npm run dev
```

## Testing the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this repo
5. The slowmo icon should appear in your extensions bar

To test:
- Visit any website with animations
- Look for the amber clock icon in the bottom-right corner
- Click it to expand the speed controls
- Try different speeds and the skip (∞) button

To reload after code changes:
- Go to `chrome://extensions`
- Click the refresh icon on the slowmo card

## Project Structure

```
slowmo/
├── src/           # Library source
├── demo/          # Demo website
├── extension/     # Chrome extension
│   ├── manifest.json
│   ├── content.js    # Injected script + UI
│   ├── popup.html    # Extension popup
│   └── icons/
└── test/          # Tests
```

## Running Tests

```bash
npm test
```

## Code Style

- TypeScript for the library
- Vanilla JS for the extension (to avoid build step)
- Keep bundle size minimal

## Pull Requests

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a PR

For major changes, please open an issue first to discuss.
