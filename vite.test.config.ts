import { defineConfig } from 'vite';

// Vite config for serving test fixtures
export default defineConfig({
  root: '.',
  server: {
    port: 5174,  // Different port from demo server to avoid conflicts
    strictPort: true,
  },
  // Allow serving files from the entire project
  publicDir: false,
});
