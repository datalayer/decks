/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['src/__tests__/**/*.test.ts'] },
});
