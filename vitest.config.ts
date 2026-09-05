import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: { environment: 'jsdom', include: ['src/**/__tests__/**/*.test.ts?(x)'] },
  resolve: {
    alias: {
      '@datalayer/reactor/react': resolve(__dirname, '../reactor/src/react/index.ts'),
      '@datalayer/reactor': resolve(__dirname, '../reactor/src/index.ts'),
    },
  },
});
