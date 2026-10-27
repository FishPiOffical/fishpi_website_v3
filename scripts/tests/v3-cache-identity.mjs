import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
const source = (await fs.readFile(new URL('../../src/utils/swr.ts', import.meta.url), 'utf8')).replaceAll('import.meta.env.SSR', 'false')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const cache = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const state = { loading: { value: false }, error: { value: '' } }
const loader = cache.createSwrLoader(state)
const old = deferred()
let shown
const pending = loader('viewer', () => old.promise, data => { shown = data })
cache.clearCache()
old.resolve('private-old-user')
await pending
assert.equal(shown, undefined)
assert.equal(cache.readCache('viewer'), undefined)
console.log('PASS cache 1 identity invalidation prevents late private results from applying or repopulating cache')
const stale = deferred()
const first = loader('viewer', () => stale.promise, data => { shown = data })
cache.clearCache()
await loader('viewer', async () => 'new-viewer', data => { shown = data })
stale.resolve('old-viewer')
await first
assert.equal(shown, 'new-viewer')
assert.equal(cache.readCache('viewer'), 'new-viewer')
console.log('PASS cache 2 later identity wins both rendered data and memory cache')
cache.clearCache()
await loader('empty', async () => [], data => { shown = data })
assert.deepEqual(shown, [])
const fail = cache.createSwrLoader(state)
await fail('failure', async () => { throw new Error('real backend failure') }, () => assert.fail('no fallback'))
assert.equal(state.error.value, 'real backend failure')
console.log('PASS cache 3 valid empty data and explicit errors preserve their meaning')
