import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
const source = await fs.readFile('src/seo/publicHomeCache.ts', 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { createPublicHomeCache } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
let now = 1000, calls = 0, release
Date.now = () => now
const read = createPublicHomeCache(15000, 2)
const load = () => { calls++; return new Promise(resolve => { release = resolve }) }
const first = read('recent', load), second = read('recent', load)
await Promise.resolve(); assert.equal(calls, 1)
release([{ title: '公开标题' }])
const a = await first, b = await second
a[0].title = '消费或修改当前请求'
assert.equal(b[0].title, '公开标题')
assert.equal((await read('recent', load))[0].title, '公开标题')
assert.equal(calls, 1)
now += 15000
assert.deepEqual(await read('recent', async () => { calls++; return [] }), [])
assert.equal(calls, 2)
assert.deepEqual(await read('recent', load), [])
let attempts = 0
for (let i = 0; i < 2; i++) await assert.rejects(read('failed', async () => { attempts++; throw Error('upstream 503') }))
assert.equal(attempts, 2)
await read('other-origin:recent', async () => ['other'])
assert.deepEqual(await read('recent', load), [])
await read('third', async () => ['third'])
assert.deepEqual(await read('recent', async () => ['evicted']), ['evicted'])
console.log('PASS public home cache: concurrent dedupe, request clone isolation, TTL, valid empty, uncached failures, origin separation and bounded eviction')
