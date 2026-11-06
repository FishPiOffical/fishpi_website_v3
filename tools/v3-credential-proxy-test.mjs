import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'

const calls = []
const upstream = http.createServer(async (req, res) => {
  let body = ''
  for await (const chunk of req) body += chunk
  calls.push({ path: req.url, host: req.headers.host, origin: req.headers.origin, referer: req.headers.referer, body })
  const proof = req.headers.origin || req.headers.referer
  let same = false
  try { same = new URL(proof).host === req.headers.host } catch { /* Missing/invalid proof is rejected. */ }
  res.statusCode = same ? 200 : 403
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ code: same ? 0 : 'forbidden' }))
})
await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
const target = `http://127.0.0.1:${upstream.address().port}`
const reservation = http.createServer()
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve))
const port = reservation.address().port
await new Promise(resolve => reservation.close(resolve))
const site = `http://127.0.0.1:${port}`
const child = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, NODE_ENV: 'development', PORT: String(port), VITE_API_TARGET: target },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let output = ''
child.stdout.on('data', chunk => { output += chunk })
child.stderr.on('data', chunk => { output += chunk })
async function post(path, headers = {}) {
  const response = await fetch(site + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: '{"fixture":true}' })
  await response.text()
  return response.status
}
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { clearInterval(poll); reject(Error('Development proxy startup timeout')) }, 20000)
    const poll = setInterval(() => {
      if (output.includes(`FishPi SSR ${site}`)) { clearInterval(poll); clearTimeout(timeout); resolve() }
    }, 20)
    child.once('exit', () => { clearInterval(poll); clearTimeout(timeout); reject(Error('Development proxy exited during startup')) })
  })
  for (const endpoint of ['login', 'refresh', 'logout']) {
    assert.equal(await post(`/api/v3/auth/${endpoint}`, { Origin: site, Referer: `${site}/login` }), 200)
    assert.equal(calls.at(-1).host, new URL(site).host)
    assert.equal(calls.at(-1).body, '{"fixture":true}')
    console.log(`PASS credential proxy ${endpoint} preserves browser authority, origin and body`)
  }
  for (const endpoint of ['refresh', 'logout']) {
    assert.equal(await post(`/api/v3/auth/${endpoint}`, { Origin: 'https://foreign.invalid', Referer: `${site}/login` }), 403)
    console.log(`PASS credential proxy ${endpoint} does not upgrade a foreign origin`)
  }
  assert.equal(await post('/api/v3/auth/refresh', { Referer: `${site}/settings` }), 200)
  assert.equal(await post('/api/v3/auth/refresh'), 403)
  assert.equal(await post('/api/v3/auth/refresh', { Referer: 'https://foreign.invalid/' }), 403)
  console.log('PASS credential proxy retains a real Referer and never synthesizes missing/foreign origin proof')
  await post('/api/v3/auth/refresh-extra', { Origin: site })
  assert.equal(calls.at(-1).host, new URL(target).host)
  await post('/api/v3/markdown/preview', { Origin: site })
  assert.equal(calls.at(-1).host, new URL(target).host)
  console.log('PASS credential proxy exact endpoint match leaves other API proxy authority unchanged')
} finally {
  if (child.exitCode === null) {
    const stopped = new Promise(resolve => child.once('exit', resolve))
    child.kill('SIGTERM')
    await stopped
  }
  await new Promise(resolve => upstream.close(resolve))
}
