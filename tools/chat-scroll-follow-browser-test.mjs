import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const code = ts.transpileModule(fs.readFileSync('src/utils/chatScrollFollow.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const moduleURL = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 800 } })
  await page.setContent(`<style>.scroll{height:240px;width:360px;overflow:auto;overflow-anchor:none;display:flex;flex-direction:column}.content{flex-shrink:0}.row{height:70px}</style><div id="modern" class="scroll" tabindex="0"></div><div id="floating" class="scroll" tabindex="0"></div>`)
  await page.evaluate(async url => {
    const { createChatScrollFollow } = await import(url)
    window.controls = {}
    for (const id of ['modern', 'floating']) {
      const el = document.getElementById(id)
      window.controls[id] = createChatScrollFollow(el, '.content', value => { el.dataset.following = String(value) })
    }
    // 先挂载滚动容器，之后才出现列表，覆盖原来监听不到后挂载内容的分支。
    await new Promise(r => setTimeout(r, 20))
    for (const el of document.querySelectorAll('.scroll')) {
      el.innerHTML = '<div class="content">' + '<div class="row">消息</div>'.repeat(12) + '</div>'
    }
  }, moduleURL)
  const gap = id => page.locator('#' + id).evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight)
  await page.waitForTimeout(120)
  for (const id of ['modern', 'floating']) assert.ok(await gap(id) < 2, id + ' 初次贴底')
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.content')) {
      const row = document.createElement('div'); row.className = 'row'; el.append(row)
      row.animate([{height:'0px'}, {height:'180px'}], {duration:260,fill:'forwards'})
      // 模拟叠卡增高与图片晚到，晚于 nextTick 和入场动画。
      setTimeout(() => { const image = document.createElement('div'); image.style.height = '250px'; el.append(image) }, 380)
    }
  })
  await page.waitForTimeout(700)
  for (const id of ['modern', 'floating']) assert.ok(await gap(id) < 2, id + ' 动画及晚到图片后仍贴底')
  for (const id of ['modern', 'floating']) {
    const top = await page.locator('#' + id).evaluate(el => {
      el.dispatchEvent(new WheelEvent('wheel', {deltaY:-350}))
      el.scrollTop -= 350
      return el.scrollTop
    })
    await page.waitForTimeout(30)
    await page.locator('#' + id + ' .content').evaluate(el => { const row = document.createElement('div'); row.style.height = '160px'; el.append(row) })
    await page.waitForTimeout(100)
    assert.equal(await page.locator('#' + id).evaluate(el => el.scrollTop), top, id + ' 阅读历史不抢位置')
    await page.locator('#' + id).evaluate(el => {
      el.dispatchEvent(new WheelEvent('wheel', {deltaY:1000}))
      el.scrollTop = el.scrollHeight
    })
    await page.waitForTimeout(60)
    await page.locator('#' + id + ' .content').evaluate(el => { el.firstElementChild.style.height = '500px' })
    await page.waitForTimeout(100)
    assert.ok(await gap(id) < 2, id + ' 手动回底后恢复跟随')
  }
  await page.evaluate(() => {
    for (const id of ['modern','floating']) {
      window.controls[id].pause()
      const el = document.getElementById(id), before = el.scrollHeight
      el.querySelector('.content').insertAdjacentHTML('afterbegin', '<div style="height:300px">旧消息</div>')
      el.scrollTop += el.scrollHeight - before
    }
  })
  await page.waitForTimeout(80)
  await page.evaluate(() => { for (const c of Object.values(window.controls)) c.jump() })
  await page.waitForTimeout(60)
  for (const id of ['modern', 'floating']) assert.ok(await gap(id) < 2, id + ' 显式返回最新')
  await page.evaluate(() => { for (const c of Object.values(window.controls)) c.dispose() })
  console.log('PASS 两种容器：延迟挂载、260ms 动画、晚到图片、历史阅读、回底恢复、历史加载与清理')
} finally { await browser.close() }
