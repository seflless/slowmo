import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      outDir: 'dist',
    }),
  ],
  build: {
    lib: {
      entry: {
        slowmo: resolve(__dirname, 'src/index.ts'),
        dial: resolve(__dirname, 'src/dial-api.ts'),
        react: resolve(__dirname, 'src/react.tsx'),
        recreate: resolve(__dirname, 'src/recreate.ts'),
        'cli/index': resolve(__dirname, 'src/cli/index.ts'),
        'cli/recreate': resolve(__dirname, 'src/cli/recreate.ts'),
      },
      name: 'slowmo',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['gsap', 'fs', 'path', 'react', 'node:fs', 'node:path', 'node:os', 'node:child_process'],
      output: {
        globals: {
          gsap: 'gsap',
        },
      },
    },
  },
});
