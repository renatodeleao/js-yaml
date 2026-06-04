import { rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { build } from 'vite'
import es5 from './vite-plugin-es5.mjs'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

const banner = `/*! ${pkg.name} ${pkg.version} https://github.com/${pkg.repository} @license ${pkg.license} */`

const common = {
  configFile: false,
  logLevel: 'info',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    target: 'es2015'
  }
}

await rm('dist', { recursive: true, force: true })

await build({
  ...common,
  build: {
    ...common.build,
    minify: false,
    lib: {
      entry: 'lib/index_vite_proxy.tmp.mjs',
      name: 'jsyaml',
      formats: ['umd'],
      fileName: () => 'js-yaml.js'
    },
    rollupOptions: {
      external: [],
      output: { banner },
      plugins: [es5()]
    }
  }
})

await build({
  ...common,
  build: {
    ...common.build,
    minify: false,
    lib: {
      entry: 'lib/index_vite_proxy.tmp.mjs',
      name: 'jsyaml',
      formats: ['umd'],
      fileName: () => 'js-yaml.min.js'
    },
    rollupOptions: {
      external: [],
      output: { banner },
      plugins: [es5({ minify: true })]
    }
  }
})

await build({
  ...common,
  build: {
    ...common.build,
    sourcemap: true,
    minify: false,
    lib: {
      entry: 'lib/index_vite_proxy.tmp.mjs',
      formats: ['es'],
      fileName: () => 'js-yaml.mjs'
    },
    rollupOptions: {
      external: [],
      output: { banner }
    }
  }
})
