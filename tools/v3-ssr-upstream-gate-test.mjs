import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'

const source = await fs.readFile('src/seo/ssrUpstreamGate.ts', 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { createSsrUpstreamGate } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
let now = 1000
Date.now = () => now
const run = createSsrUpstreamGate()
const deferred = { code: 'ssr_deferred' }
const unexpected = () => assert.fail('must not start an upstream request')
let resolveFirst, rejectSecond
const first = run(() => new Promise(resolve => { resolveFirst = resolve }))
await assert.rejects(run(unexpected), deferred)
now += 500
const second = run(() => new Promise((_, reject) => { rejectSecond = reject }))
now += 500
await assert.rejects(run(unexpected), deferred)
rejectSecond({ status: 429, retryAfter: '60' })
await assert.rejects(second, { status: 429 })
resolveFirst('old success')
assert.equal(await first, 'old success')
now += 59_999
await assert.rejects(run(unexpected), deferred)
now++
let resolveProbe
const probe = run(() => new Promise(resolve => { resolveProbe = resolve }))
now += 500
await assert.rejects(run(unexpected), deferred)
resolveProbe('recovered')
assert.equal(await probe, 'recovered')
assert.equal(await run(async () => 'normal'), 'normal')

const timeout = { code: 'ssr_timeout' }
const fail = async () => { throw timeout }
now += 500
await assert.rejects(run(fail), timeout)
now += 500
await assert.rejects(run(fail), timeout)
now += 29_999
await assert.rejects(run(unexpected), deferred)
now++
await assert.rejects(run(fail), timeout)
now += 59_999
await assert.rejects(run(unexpected), deferred)
now++
assert.equal(await run(async () => true), true)
console.log('PASS SSR rate and concurrency budgets, Retry-After, late success isolation, transport backoff and single recovery probe')
