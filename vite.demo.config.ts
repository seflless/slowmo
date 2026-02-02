import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'demo',
  base: './',
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'demo/index.html'),
        'privacy-policy': resolve(__dirname, 'demo/privacy-policy.html'),
      },
    },
  },
  resolve: {
    alias: {
      slowmo: resolve(__dirname, 'src/index.ts'),
    },
  },
});
