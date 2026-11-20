import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { testEnv } from './test-env'

// The API is CommonJS, so __dirname (not import.meta) is available here
const src = path.resolve(__dirname, '..')

export default defineConfig({
  resolve: { alias: { '@': src } },
  test: {
    root: src,
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup.ts'],
    env: testEnv,
    // One database for every file: run them one after the other
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 60_000,
  },
})
