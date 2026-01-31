import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/src/__tests__/integration/**/*.test.ts'],
    globals: true,
    environment: 'node',
    // Run integration tests sequentially with process isolation
    fileParallelism: false,
    isolate: true,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
