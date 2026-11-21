import { defineConfig } from 'vitest/config';

// Unit tests only: pure logic in Node. No browser, no watch mode (`vitest run`).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
    passWithNoTests: true,
  },
});
