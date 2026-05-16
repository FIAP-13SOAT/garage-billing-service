import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    exclude: ['dist/**', 'node_modules/**'],
    env: {
      DD_TRACE_ENABLED: 'false',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary', 'json'],
      exclude: [
        'src/instrument.ts',
        'src/server.ts',
        'src/app.ts',
        'src/shared/config/**',
        'src/adapters/outbound/database/connection.ts',
        'src/adapters/outbound/messaging/**',
        'src/adapters/inbound/messaging/**',
        'dist/**',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
      },
    },
  },
});
