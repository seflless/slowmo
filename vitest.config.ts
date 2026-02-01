import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/index.ts'],
    },
  },
});
