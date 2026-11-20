import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'

const source = ts.transpileModule(await fs.readFile('src/utils/captchaDiagnostics.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replaceAll('import.meta.env?.SSR', 'false')
const stored = new Map()
const captured = []
const originalLog = console.log
console.log = (...args) => captured.push(args)
globalThis.window = { sessionStorage: {
  getItem: key => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
} }
const load = iteration => import('data:text/javascript;base64,' + Buffer.from(source + `\n// ${iteration}`).toString('base64'))
try {
  const first = await load(1)
  assert.equal(first.captchaDiagnosticPath('/api/v3/users/sensitive-user?token=secret#private'), '/api/v3/users/:value')
  assert.equal(first.captchaDiagnosticPath('/api/v3/articles/123/comments?key=secret'), '/api/v3/articles/:value/comments')
  assert.equal(first.captchaDiagnosticOrigin('https://fishpi.cn/api/v3/me?key=secret'), 'https://fishpi.cn')
  assert.equal(first.captchaDiagnosticOrigin('invalid response url'), null)
  first.captchaDiagnostic('gate.open', { flowId: 'flow-fixture', gateId: 'gate-fixture', authorization: 'secret-token', body: 'private-content' })
  first.captchaDiagnostic('gate.error', first.captchaDiagnosticError(new Error('private-error-proof')))
  const before = JSON.parse(window.fpCaptchaDiagnostics.export()).events
  assert.ok(before.some(event => event.flowId === 'flow-fixture'))
  const second = await load(2)
  second.captchaDiagnostic('gate.close', { flowId: 'flow-fixture', reason: 'success' })
  const report = window.fpCaptchaDiagnostics.export()
  assert.ok(JSON.parse(report).events.some(event => event.event === 'gate.open' && event.flowId === 'flow-fixture'))
  assert.ok(!report.includes('secret-token') && !report.includes('private-content') && !report.includes('private-error-proof'))
  for (let index = 0; index < 650; index++) second.captchaDiagnostic('widget.ready', { generation: index })
  assert.equal(JSON.parse(window.fpCaptchaDiagnostics.export()).events.length, 600)
  window.fpCaptchaDiagnostics.clear()
  assert.equal(JSON.parse(window.fpCaptchaDiagnostics.export()).events.length, 0)
  window.sessionStorage.setItem = () => { throw new Error('storage blocked') }
  second.captchaDiagnostic('gate.open', { flowId: 'flow-memory' })
  assert.ok(JSON.parse(window.fpCaptchaDiagnostics.export()).events.some(event => event.event === 'storage.unavailable'))
  assert.ok(JSON.parse(window.fpCaptchaDiagnostics.export()).events.some(event => event.flowId === 'flow-memory'))
  assert.ok(captured.every(args => args[0] === '[FP captcha]' && typeof args[1] === 'string'))
  console.log = originalLog
  console.log('PASS captcha diagnostics: path/field/error privacy, copyable JSON, refresh retention, bounded history, clearing and denied storage')
} finally {
  console.log = originalLog
}
