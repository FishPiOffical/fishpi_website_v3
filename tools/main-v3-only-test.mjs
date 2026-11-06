import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { v3Only } from '../server/v3-only.ts'

const calls = []
const upstream = http.createServer((req, res) => {
  calls.push({ path: req.url, headers: req.headers })
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ code: 0, data: { protocol: 'v3' } }))
}).listen(0, '127.0.0.1')
await new Promise(resolve => upstream.once('listening', resolve))
const gate = http.createServer((req, res) => v3Only(req, res, () => { res.end('v3-or-page') })).listen(0, '127.0.0.1')
await new Promise(resolve => gate.once('listening', resolve))
const reserve = http.createServer().listen(0, '127.0.0.1')
await new Promise(resolve => reserve.once('listening', resolve))
const port = reserve.address().port
await new Promise(resolve => reserve.close(resolve))
const site = `http://127.0.0.1:${port}`
const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, NODE_ENV: 'development', PORT: String(port), VITE_API_TARGET: `http://127.0.0.1:${upstream.address().port}`, VITE_API_MODE: 'v1', VITE_API_V1_TARGET: 'http://127.0.0.1:1' }, stdio: ['ignore', 'pipe', 'pipe'] })
let log = ''
child.stdout.on('data', value => log += value)
child.stderr.on('data', value => log += value)
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { clearInterval(poll); reject(Error('v3-only server startup timeout')) }, 20000)
    const poll = setInterval(() => { if (log.includes(`FishPi SSR ${site}`)) { clearTimeout(timer); clearInterval(poll); resolve() } }, 20)
    child.once('exit', () => { clearTimeout(timer); clearInterval(poll); reject(Error('v3-only server exited')) })
  })
  for (const base of [site, `http://127.0.0.1:${gate.address().port}`]) {
    for (const path of ['/api', '/api/getKey', '/api/user?apiKey=synthetic-retired', '/api/v1/me']) {
      const response = await fetch(base + path, { headers: { Cookie: 'fp.apiMode=v1' } })
      assert.equal(response.status, 410)
      assert.match((await response.json()).msg, /仅支持 v3/)
      assert.equal(response.headers.get('cache-control'), 'no-store')
    }
  }
  assert.equal(calls.length, 0, 'retired API reached upstream')
  const response = await fetch(site + '/api/v3/me', { headers: { Cookie: 'fp.apiMode=v1; fp_v3_refresh=synthetic-refresh', Authorization: 'Bearer synthetic-v3', 'X-FP-API-Mode': 'v1', 'X-FP-Legacy-Key': 'synthetic-retired' } })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).data.protocol, 'v3')
  assert.equal(calls.at(-1).path, '/api/v3/me')
  assert.equal(calls.at(-1).headers.authorization, 'Bearer synthetic-v3')
  assert.equal(calls.at(-1).headers.cookie, ' fp_v3_refresh=synthetic-refresh'.trim())
  assert.equal(calls.at(-1).headers['x-fp-legacy-key'], undefined)
  assert.equal(calls.at(-1).headers['x-fp-api-mode'], undefined)
  async function scan(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const path = directory + '/' + entry.name
      if (entry.isDirectory()) await scan(path)
      else if (/\.(?:vue|ts)$/.test(path)) assert.ok(!/getApiMode|switchApiMode|installModeSync|api\/legacy\/|stores\/legacy|legacyLogin|VITE_API_V1_TARGET/.test(await fs.readFile(path, 'utf8')), path + ' still activates retired adapters')
    }
  }
  await scan('src')
  for (const path of ['src/api/legacy', 'src/api/mode.ts', 'src/components/settings/ApiModeSettings.vue', 'server/api-mode.ts', 'scripts/dev-auth.mjs']) await assert.rejects(fs.access(path))
  const settings = await fs.readFile('src/components/settings/SettingsDrawer.vue', 'utf8')
  assert.ok(settings.includes('需求反馈') && !settings.includes('接口版本'))
  const feedback = await fs.readFile('feedback-service/src/app.ts', 'utf8')
  assert.ok(feedback.includes("new URL('/api/v3/me'") && !/verifyLegacy|x-fp-legacy-key|api\/user\?/.test(feedback))
  console.log('PASS main v3-only: actual server and shared SPA gate reject old API without upstream calls; old cookie/env/header cannot select v1, Bearer/refresh preserved, retired source and switch removed, feedback stays v3')
} finally {
  if (child.exitCode === null) { const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await stopped }
  await Promise.all([new Promise(resolve => upstream.close(resolve)), new Promise(resolve => gate.close(resolve))])
}
