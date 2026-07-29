import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import * as babel from '@babel/core'
import path from 'path'

/**
 * Mirrors the production transform: next.config.ts sets `reactCompiler`, so the
 * render-count tests must see babel-plugin-react-compiler too, otherwise they
 * measure a component tree that never ships. Runs `pre` so it sees TSX before
 * the JSX/TS syntax is stripped.
 */
function reactCompiler(): Plugin {
  return {
    name: 'react-compiler-for-tests',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.includes('/src/') || !id.endsWith('.tsx')) return null

      const result = await babel.transformAsync(code, {
        filename: id,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        parserOpts: { plugins: ['typescript', 'jsx'] },
        plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      })

      if (!result?.code) return null
      // Serialized because Babel's map type is structurally looser than Vite's.
      return { code: result.code, map: result.map ? JSON.stringify(result.map) : null }
    },
  }
}

export default defineConfig({
  plugins: [reactCompiler(), react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/**/*.ts',
        'src/services/**/*.ts',
        'src/app/api/**/*.ts',
        'src/app/actions/**/*.ts',
        'src/schemas/**/*.ts',
        'src/domain/**/*.ts',
        'src/features/**/*.ts',
      ],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/__tests__/**',
        'src/lib/fonts/**',
        'src/assets/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
