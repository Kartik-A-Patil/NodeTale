import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    // All tests live in tests/: unit tests here, browser tests in tests/e2e (npm run test:e2e).
    include: ['tests/unit/**/*.test.ts'],
  },
});
