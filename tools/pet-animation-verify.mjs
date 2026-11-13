import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

// 在独立浏览器和临时只读静态服务中检查素材，不访问站点接口或正在长跑的服务。
const root = process.cwd()
const temp = path.join(root, '.temp/hexiaotun-animations-v1/qa')
await fs.mkdir(temp, { recursive: true })
const mime = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.webm': 'video/webm', '.json': 'application/json' }
const failures = []
const server = http.createServer(async (request, response) => {
  try {
    const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    const file = path.resolve(root, `.${name}`)
    if (!file.startsWith(`${root}/docs/pets-art/hexiaotun-animations-v1/`) && !file.startsWith(`${root}/public/images/pets/animations/hexiaotun-v1/`)) throw new Error('denied')
    const content = await fs.readFile(file)
    response.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'content-length': content.length })
    response.end(content)
  } catch { if (request.url !== '/favicon.ico') failures.push(request.url); response.writeHead(404); response.end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const profile = path.join(temp, `chrome-${Date.now()}`)
const browser = spawn(process.env.PET_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let socket
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
try {
  let address
  for (let count = 0; count < 100; count += 1) {
    try { const [debugPort, endpoint] = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n'); address = `ws://127.0.0.1:${debugPort}${endpoint}`; break } catch { await delay(100) }
  }
  if (!address) throw new Error('独立浏览器未启动')
  socket = new WebSocket(address)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  let nextId = 0
  const pending = new Map()
  const exceptions = []
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id)
      pending.delete(message.id); clearTimeout(timer)
      if (message.error) reject(new Error(message.error.message)); else resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text)
  }
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`超时：${method}`)) }, 30000)
    pending.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
  })
  const version = await send('Browser.getVersion')
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const call = (method, params = {}) => send(method, params, sessionId)
  const evaluate = async expression => {
    const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text)
    return response.result.value
  }
  await call('Runtime.enable')
  await call('Page.enable')
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  await call('Page.navigate', { url: `http://127.0.0.1:${port}/docs/pets-art/hexiaotun-animations-v1/preview.html` })
  await delay(700)
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'public/images/pets/animations/hexiaotun-v1/manifest.json'), 'utf8'))
  assert.equal(manifest.clips.length, 10)
  const clips = []
  for (const clip of manifest.clips) {
    const result = await evaluate(`(async()=>{
      document.querySelector('[data-id="${clip.id}"]').click();const video=document.querySelector('#player');
      await new Promise((resolve,reject)=>{if(video.readyState>=2)return resolve();const timer=setTimeout(()=>reject(new Error('media load timeout')),8000);video.addEventListener('loadeddata',()=>{clearTimeout(timer);resolve()},{once:true})});
      video.pause();video.currentTime=video.duration*.43;
      await new Promise(resolve=>video.addEventListener('seeked',resolve,{once:true}));
      const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.drawImage(video,0,0);const pixels=ctx.getImageData(0,0,256,256).data;let transparent=0,partial=0,solid=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)transparent++;else if(pixels[i]<240)partial++;else solid++}
      video.currentTime=video.duration-.15;await new Promise(resolve=>video.addEventListener('seeked',resolve,{once:true}));video.loop=true;await video.play();await new Promise(resolve=>setTimeout(resolve,500));const currentTime=video.currentTime;video.pause();return {id:'${clip.id}',width:video.videoWidth,height:video.videoHeight,duration:video.duration,transparent,partial,solid,currentTime,error:video.error?.message||null}
    })()`)
    assert.equal(result.width, 256); assert.equal(result.height, 256)
    assert.equal(result.error, null); assert.ok(result.transparent > 10000, `${clip.id} 透明区域不足`)
    assert.ok(result.solid > 12000, `${clip.id} 主体没有正确渲染`)
    assert.ok(result.currentTime < result.duration - .2, `${clip.id} 未完成循环`)
    assert.ok(Math.abs(result.duration - clip.duration) < .08, `${clip.id} 时长不一致`)
    clips.push(result)
  }
  async function screenshot(name) {
    const { data } = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    await fs.writeFile(path.join(temp, name), Buffer.from(data, 'base64'))
  }
  await evaluate(`document.querySelector('[data-id="idle"]').click();document.querySelector('#background').value='dark';document.querySelector('#background').dispatchEvent(new Event('change'));`)
  await delay(300)
  await screenshot('desktop-dark.png')
  await evaluate(`document.querySelector('#compare').click()`)
  await delay(700)
  await evaluate(`for(const v of document.querySelectorAll('#all video'))v.pause();document.querySelector('#player').pause()`)
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false })
  await screenshot('all-dark.png')
  await evaluate(`document.querySelector('#background').value='light';document.querySelector('#background').dispatchEvent(new Event('change'));`)
  await screenshot('all-light.png')
  await evaluate(`document.querySelector('#compare').click();document.querySelector('#size').value='128';document.querySelector('#size').dispatchEvent(new Event('change'));`)
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 1100, deviceScaleFactor: 1, mobile: true })
  await delay(300)
  await screenshot('mobile-128.png')
  const mobile = await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,renderedVideo:document.querySelector('#player').getBoundingClientRect().width,buttons:document.querySelectorAll('.clip').length})`)
  assert.equal(mobile.width, mobile.scrollWidth); assert.equal(mobile.renderedVideo, 128); assert.equal(mobile.buttons, 10)
  assert.deepEqual(failures, []); assert.deepEqual(exceptions, [])
  const report = { date: new Date().toISOString(), browser: version.product, clips, mobile, failedLocalResources: failures, runtimeExceptions: exceptions, note: '独立素材预览验证；不代表已接入宠物家园或服务端活动。' }
  await fs.writeFile(path.join(root, 'docs/pets-art/hexiaotun-animations-v1/validation.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: clips.length, totalBytes: manifest.totalBytes, mobile, screenshots: temp }, null, 2))
} finally {
  socket?.close()
  browser.kill('SIGTERM')
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
