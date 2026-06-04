import babel from '@babel/core'
import presetEnv from '@babel/preset-env'
import { minify as terserMinify } from 'terser'

// Rolldown includes the output.banner in chunk.code; extract it so Babel
// doesn't shuffle it among its generated helpers, then re-prepend it.
function extractBanner (code) {
  const match = code.match(/^(\/\*![\s\S]*?\*\/\n)/)
  return match ? [match[1], code.slice(match[1].length)] : ['', code]
}

// Rolldown unconditionally emits Symbol.toStringTag in its UMD interop block.
// Replace the whole defineProperties call with an ES5-safe defineProperty so
// ES5 targets (which lack Symbol) never see a Symbol reference.
function stripRolldownInterop (code) {
  return code
    .replace(
      /Object\.defineProperties\(exports,\s*\{[\s\S]*?__esModule[\s\S]*?\[Symbol\.toStringTag\][\s\S]*?\}\);/,
      "Object.defineProperty(exports, '__esModule', { value: true });"
    )
    .replace(/Object\.defineProperty\(exports,\s*Symbol\.toStringTag[^)]+\);\n?/g, '')
}

async function toEs5 (code, { compact, comments }) {
  const [banner, body] = extractBanner(code)
  const stripped = stripRolldownInterop(body)

  const result = await babel.transformAsync(stripped, {
    presets: [[presetEnv, {
      targets: { ie: 11 },
      modules: false,
      // This codebase has no Symbol usage, so the _typeof helper Babel would
      // inject (wrapping every typeof call to handle Symbol values) is dead
      // weight. Exclude it to keep the bundle lean.
      exclude: ['transform-typeof-symbol']
    }]],
    compact,
    comments
  })

  return banner + result.code
}

/**
 * Vite/Rolldown plugin that transpiles each UMD chunk to ES5 via Babel and,
 * when `minify: true`, also runs Terser.
 *
 * NOTE: Uses the `generateBundle` hook instead of `renderChunk` because
 * Rolldown re-generates code from its AST after `renderChunk`, undoing any
 * syntax transformations. Modifications to `chunk.code` in `generateBundle`
 * are written to disk directly.
 *
 * @param {{ minify?: boolean }} [options]
 */
export default function es5 ({ minify = false } = {}) {
  return {
    name: 'vite-plugin-es5',
    async generateBundle (_, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue

        const es5Code = await toEs5(chunk.code, { compact: minify, comments: !minify })

        if (!minify) {
          chunk.code = es5Code
          continue
        }

        const terserResult = await terserMinify(es5Code, {
          ecma: 5,
          compress: { ecma: 5 },
          mangle: true,
          format: { comments: false }
        })
        // Terser strips all comments; re-extract the banner from the es5 code
        // and prepend it to the minified output.
        const [banner] = extractBanner(es5Code)
        chunk.code = banner + terserResult.code
      }
    }
  }
}
