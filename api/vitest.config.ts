import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // shared-types' package.json points `import` at `./dist/index.js` so
      // the compiled node runtime works. Vitest/Vite also resolves via the
      // `import` condition — which means without this alias tests would need
      // a prior `npm run build -w india-learns-shared-types` to avoid
      // "Failed to resolve entry" on clean CI runs. Alias straight to src.
      'india-learns-shared-types': path.resolve(HERE, '../packages/shared-types/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/services/**/*.ts'],
      exclude: ['src/services/**/*.test.ts'],
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 55,
      },
    },
  },
});
