import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const data = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
const transpile = code => ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const vue = data(fs.readFileSync('node_modules/vue/dist/vue.esm-browser.prod.js', 'utf8'))
const stub = data(`import {h} from '${vue}';export default {setup(_,{slots}){return()=>slots.default?.()||null}}`)
// 只替换身份、路由容器和网络组件；正文解析、气泡与引用卡片使用真实源码。
const mocks = data(`import {reactive,h} from '${vue}';
export const prefs=reactive({simpleMode:false,blurChatImages:false});window.prefs=prefs;
export const useAuthStore=()=>({account:{oId:'me'}});
export const useChatPreferencesStore=()=>prefs,useFunctionPreferencesStore=()=>prefs;
export const CHAT_MENTION=Symbol(),chatMentionText=x=>x,chatPetStatusLabels={};
export const formatDisplayTime=()=> '2026-11-14 13:07';
export const RouterLink={props:{to:{},custom:Boolean},setup(p,{slots}){return()=>p.custom
  ? slots.default?.({href:p.to,navigate(event){if(event?.ctrlKey||event?.metaKey)return;event?.preventDefault();window.avatarNavigations.push(p.to)}})
  : h('a',{href:p.to},slots.default?.())}};`)
const modules = { vue, 'vue-router': mocks }
for (const path of ['@/stores/auth', '@/stores/chatPreferences', '@/stores/functionPreferences', '@/chat/mention', '@/api/v3-chat-messages', '@/utils/time']) modules[path] = mocks
modules['@/chat/messageShortcuts'] = data(transpile(fs.readFileSync('src/chat/messageShortcuts.ts', 'utf8')))
for (const name of ['avatar', 'bubbleStyle', 'chatAppearance', 'chatMessage', 'chatQuote']) {
  const source = transpile(fs.readFileSync(`src/utils/${name}.ts`, 'utf8'))
  modules['@/utils/' + name] = data(source
    .replaceAll("'@/utils/bubbleStyle'", `'${modules['@/utils/bubbleStyle']}'`)
    .replace("'@/utils/chatMessage'", `'${modules['@/utils/chatMessage']}'`))
}
let css = ''
function compile(file, id) {
  const { descriptor } = parse(fs.readFileSync(file, 'utf8'))
  let script = transpile(compileScript(descriptor, { id, inlineTemplate: true }).content)
  script = script.replace(/from (['"])([^'"]+)\1/g, (_, q, path) => `from '${modules[path] || (path.endsWith('.vue') ? stub : path)}'`)
    .replace('export default', 'const component =')
  css += descriptor.styles.map(style => compileStyle({ source: style.content, filename: file, id, scoped: true }).code).join('\n')
  return data(script + `;component.__scopeId='${id}';export default component;`)
}
modules['@/components/ImageLightbox.vue'] = compile('src/components/ImageLightbox.vue', 'data-v-lightbox')
modules['@/components/chat/ChatQuoteCard.vue'] = compile('src/components/chat/ChatQuoteCard.vue', 'data-v-quote-card')
modules['./ChatQuoteCard.vue'] = modules['@/components/chat/ChatQuoteCard.vue']
const preview = compile('src/components/chat/ChatQuotePreview.vue', 'data-v-quote-preview')
const bubble = compile('src/components/ChatBubble.vue', 'data-v-bubble')
const avatar = 'data:image/png;base64,' + fs.readFileSync('public/images/user-thumbnail.png').toString('base64')
const excerpt = '第一行正文，保留引用内容。第二行正文很长很长，应该保持单行省略而不能撑开聊天窗口。'
const source = `1\n\n##### 引用 @Yui [↩](/cr#chatroom123 "跳转至原消息")  \n> ${excerpt}\n> 第三行引用\n`
const stripped = `<p>1</p><h5>引用 @Yui <a title="跳转至原消息">↩</a></h5><blockquote><p>${excerpt}<br>第三行引用</p></blockquote>`
const linked = '<p>这是旧版的消息</p><h5>引用 @小羊 <a href="https://fishpi.cn/cr#chatroom456">↩</a></h5><blockquote><p>普通引用内容<br>还有一行</p></blockquote>'
const previousQuote = linked.replace('<p>这是旧版的消息</p>', '')
const nextHeading = '<h5>引用 @Yui <a href="/cr#chatroom321">↩</a></h5>'
const fixtures = [
  { id: 'own', userName: 'Yui', self: true, html: stripped, source },
  { id: 'other', userName: '冰岚', html: stripped, source },
  { id: 'classic', userName: '小羊', html: linked },
  { id: 'image', userName: '图片引用', html: '<p>看图</p><h5>引用 @Yui <a href="/cr#chatroom789">↩</a></h5><blockquote><p><img src="https://file.fishpi.cn/test.png"></p></blockquote>' },
  { id: 'only', userName: '只有引用', html: linked.replace('<p>这是旧版的消息</p>', '') },
  { id: 'hand', userName: '手写引用', html: '<p>我的正文</p><blockquote><p>没有来源的普通引用</p></blockquote>' },
  { id: 'moon', userName: '清风', html: '<p>分享</p><blockquote><p><a href="https://fishpi.cn/member/Yui/breezemoons/123">清风明月 · Yui</a></p><p>快点放假吧</p></blockquote>' },
  { id: 'short', userName: '短引用', html: '<p>收到</p><h5>引用 @Yui <a href="/cr#chatroom321">↩</a></h5><blockquote><p>好</p></blockquote>' },
  { id: 'own-multi', userName: 'Yui', self: true, html: '<p>一起回复</p>' + previousQuote + nextHeading + '<blockquote><p>好</p></blockquote><blockquote><p>手写补充</p></blockquote>' },
  { id: 'nested', userName: '小羊', html: '<p>再次回复</p>' + nextHeading + '<blockquote><p>直接引用的内容</p>' + previousQuote + '</blockquote>' },
  { id: 'shortcuts', userName: 'shortcut-peer', html: '<p>Selection should still work.</p><p><a href="#normal-link">链接</a></p>' },
  { id: 'mixed-media', userName: 'media-peer', html: '<p>图文消息</p><p><img src="https://file.fishpi.cn/test.png"></p>' },
  { id: 'standalone', userName: 'standalone-peer', standalone: true, html: '<p>独立卡片</p>' },
]
const packs = fs.readFileSync('src/packs/bubbles/star-route/style.css', 'utf8')
const html = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;font:14px system-ui;background:#f4f6f8;--fp-card:#fff;--fp-border:#dfe4e9;--fp-text:#252a31;--fp-muted:#737c89;--fp-primary:#62ae37;--fp-hover:#f4f6f8;--fp-bg:#f5f6f8;--fp-self:#edf4e7;--fp-avatar-radius:8px;--fp-link:#3977c8}
a{color:inherit}.panel{padding:20px;background:white;max-width:760px;margin:16px auto}.case{margin:16px 0 24px}.title{font-size:12px;color:#7b8390;margin-bottom:12px}${css}${packs}
</style><div id="app"></div><script type="module">
import {createApp,h,ref,provide} from '${vue}';import Bubble from '${bubble}';import Preview from '${preview}';
import {CHAT_MENTION} from '${mocks}';import {CHAT_QUICK_QUOTE} from '${modules['@/chat/messageShortcuts']}';
const fixtures=${JSON.stringify(fixtures)};const narrow=ref(false);window.narrow=narrow;
window.mentions=[];window.quickQuotes=[];window.avatarNavigations=[];window.shortcutsEnabled=true;
createApp({setup(){
provide(CHAT_MENTION,{enabled:()=>window.shortcutsEnabled,insert:name=>window.mentions.push(name)});
provide(CHAT_QUICK_QUOTE,{enabled:()=>window.shortcutsEnabled,quote:id=>window.quickQuotes.push(id)});
return ()=>h('div',{class:'panel'},[
...fixtures.map(f=>h('section',{class:'case','data-case':f.id},[h('div',{class:'title'},f.id),h(Bubble,{...f,chatroom:true,messageId:f.id,userId:f.self?'me':'other',avatar:'${avatar}',avatarSize:narrow.value?24:36,appearance:{bubbleId:'star-route',frameId:'none',version:1}})])),
h('section',{class:'case','data-case':'preview'},[h(Preview,{quotes:[{kind:'message',href:'/cr#chatroom123',author:'Yui',excerpt:${JSON.stringify(excerpt)}}],onRemove:()=>window.removed=true})])
])}}).mount('#app');
</script>`

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1300 } })
  const errors = [], requests = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('request', r => requests.push(r.url()))
  await page.route('http://quotes.test/**', r => r.fulfill({ contentType: 'text/html', body: html }))
  await page.route(url => url.origin === 'https://file.fishpi.cn' && url.pathname === '/test.png', r => r.fulfill({
    contentType: 'image/png', body: fs.readFileSync('public/images/user-thumbnail.png'),
  }))
  await page.goto('http://quotes.test/cr')
  await page.waitForSelector('[data-case="own"] .chat-quote-card')
  for (const id of ['own', 'other', 'classic', 'image', 'only', 'moon', 'own-multi', 'nested']) {
    const section = page.locator(`[data-case="${id}"]`)
    assert.equal(await section.locator('.chat-quote-card').count(), 1, id)
    assert.equal(await section.locator('.fp-bubble .chat-quote-card, .fp-bubble h5').count(), 0, id)
  }
  assert.equal(await page.locator('[data-case="own"] .body').innerText(), '1')
  const imageQuote = page.locator('[data-case="image"]')
  const thumbnail = imageQuote.getByRole('button', { name: '查看引用大图' })
  assert.equal(await thumbnail.locator('img').getAttribute('src'), 'https://file.fishpi.cn/test.png?imageView2/1/w/80/h/64')
  assert.equal(await page.locator('[data-case="only"] .fp-bubble').count(), 0)
  assert.equal(await page.locator('[data-case="hand"] .body blockquote').innerText(), '没有来源的普通引用')
  for (const [id, excerpt] of [['own-multi', '好'], ['nested', '直接引用的内容']]) {
    const section = page.locator(`[data-case="${id}"]`)
    assert.equal(await section.locator('.chat-quote-jump').getAttribute('href'), '/cr#chatroom321')
    assert.equal(await section.locator('.chat-quote-excerpt').innerText(), excerpt)
    assert.doesNotMatch(await section.innerText(), /普通引用内容/)
  }
  assert.equal(await page.locator('[data-case="own-multi"] .body blockquote').innerText(), '手写补充')
  for (const width of [1000, 560, 390, 320]) {
    await page.setViewportSize({ width, height: 1600 })
    await page.evaluate(() => { narrow.value = innerWidth < 560 })
    await page.waitForTimeout(60)
    const overflow = await page.evaluate(() => [...document.querySelectorAll('body *:not(script):not(style)')]
      .filter(el => el.getBoundingClientRect().right > innerWidth || el.getBoundingClientRect().left < 0)
      .map(el => ({ element: el.className, case: el.closest('[data-case]')?.getAttribute('data-case'), left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `页面横向溢出：${width} ${JSON.stringify(overflow)}`)
    for (const id of ['own', 'other', 'classic', 'short']) {
      const layout = await page.locator(`[data-case="${id}"] .chat-quote-card`).evaluate(el => {
        const preview = el.querySelector('.chat-quote-excerpt'), style = getComputedStyle(preview)
        const body = el.closest('.message-stack').querySelector('.fp-bubble').getBoundingClientRect()
        const r = el.getBoundingClientRect()
        return { whitespace: style.whiteSpace, ellipsis: style.textOverflow, width: r.width, height: r.height, top: r.top, bodyBottom: body.bottom, clipped: preview.scrollWidth > preview.clientWidth }
      })
      assert.equal(layout.whitespace, 'nowrap')
      assert.equal(layout.ellipsis, 'ellipsis')
      assert.ok(layout.top >= layout.bodyBottom, `${id} 引用应在气泡下方`)
      assert.ok(layout.height <= 26, `${id} 必须保持紧凑单行高度`)
      assert.ok(layout.width <= 240.1, `${id} 引用不能再占用过长空间`)
      if (id === 'short') assert.ok(layout.width < 150, '短引用应自然收缩')
      if (id === 'own') assert.ok(layout.clipped, '长引用应省略')
    }
    assert.ok(await page.locator('[data-case="short"] .chat-quote-author').evaluate(el => el.scrollWidth <= el.clientWidth), '短引用不能挤掉完整作者名')
    const ownEdges = await page.locator('[data-case="own-multi"] :is(.chat-quote-card, .fp-bubble)').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().right))
    assert.ok(Math.abs(ownEdges[0] - ownEdges[1]) < 1, '本人最新引用应和气泡右侧对齐')
  }
  await page.screenshot({ path: '/tmp/chat-quotes-320.png', fullPage: true })
  await page.setViewportSize({ width: 1000, height: 1200 })
  await page.evaluate(() => { narrow.value = false })
  await page.waitForTimeout(60)
  await page.screenshot({ path: '/tmp/chat-quotes-1000.png', fullPage: true })
  // 暗色复用站点主题变量，引用文字保持弱化但仍可读，不显示醒目卡片边框。
  await page.addStyleTag({ content: 'body{background:#222424;--fp-card:#282a2a;--fp-text:#cbc5ba;--fp-muted:#9e9689;--fp-border:#424545;--fp-hover:#343737;--fp-bg:#222424}.panel{background:var(--fp-card)}' })
  await page.screenshot({ path: '/tmp/chat-quotes-dark.png', fullPage: true })
  assert.equal(await page.locator('[data-case="own"] .chat-quote-excerpt').evaluate(el => getComputedStyle(el).color), 'rgb(158, 150, 137)')
  const ownQuote = page.locator('[data-case="own"] .chat-quote-card')
  const hint = page.getByRole('tooltip')
  await ownQuote.locator('.chat-quote-excerpt').hover()
  await hint.waitFor()
  assert.equal(await hint.textContent(), excerpt + '\n第三行引用')
  assert.ok(await hint.evaluate(el => {
    const rect = el.getBoundingClientRect()
    return rect.left >= 8 && rect.right <= innerWidth - 8 && rect.top >= 8 && rect.bottom <= innerHeight - 8
  }))
  await hint.hover()
  await page.waitForTimeout(180)
  assert.ok(await hint.isVisible(), '指针移到悬浮预览时应保持显示')
  await page.keyboard.press('Escape')
  await hint.waitFor({ state: 'hidden' })
  const ownJump = ownQuote.getByRole('link', { name: '查看原消息' })
  await ownJump.focus()
  await hint.waitFor()
  assert.equal(await ownJump.getAttribute('aria-describedby'), await hint.getAttribute('id'))
  await page.keyboard.press('Escape')
  await hint.waitFor({ state: 'hidden' })
  await page.locator('[data-case="own"] .chat-quote-excerpt').click()
  assert.equal(new URL(page.url()).hash, '')
  await page.evaluate(() => { prefs.blurChatImages = true })
  await thumbnail.hover()
  await hint.waitFor({ state: 'hidden' })
  assert.equal(await hint.count(), 0)
  assert.equal(await thumbnail.locator('img').evaluate(img => getComputedStyle(img).filter), 'blur(8px)')
  await thumbnail.click()
  const lightbox = page.locator('.img-zoom')
  await lightbox.waitFor()
  assert.equal(await lightbox.locator('img').getAttribute('src'), 'https://file.fishpi.cn/test.png?imageView2/1/w/1024/h/1024')
  assert.equal(await lightbox.getByRole('link', { name: '原图' }).getAttribute('href'), 'https://file.fishpi.cn/test.png')
  assert.equal(new URL(page.url()).hash, '')
  await page.keyboard.press('Escape')
  await lightbox.waitFor({ state: 'hidden' })
  await imageQuote.getByRole('link', { name: '查看原消息' }).click()
  assert.equal(new URL(page.url()).hash, '#chatroom789')
  await page.locator('[data-case="own"] .chat-quote-jump').click()
  assert.equal(new URL(page.url()).hash, '#chatroom123')
  await page.locator('[data-case="nested"] .chat-quote-jump').click()
  assert.equal(new URL(page.url()).hash, '#chatroom321')
  await page.locator('[data-case="preview"] button').click()
  assert.equal(await page.evaluate(() => window.removed), true)

  const shortcut = page.locator('[data-case="shortcuts"]')
  const avatarLink = shortcut.locator('.fp-avatar-frame')
  const message = shortcut.locator('.fp-bubble')
  assert.equal(await avatarLink.getAttribute('data-user-card'), 'shortcut-peer', '头像保留悬浮资料卡入口')
  await avatarLink.dblclick()
  assert.deepEqual(await page.evaluate(() => window.mentions), ['shortcut-peer'])
  await avatarLink.click()
  assert.deepEqual(await page.evaluate(() => window.avatarNavigations), [])
  await page.waitForFunction(() => window.avatarNavigations.length === 1)
  await avatarLink.focus()
  await page.keyboard.press('Enter')
  assert.deepEqual(await page.evaluate(() => window.avatarNavigations), ['/member/shortcut-peer', '/member/shortcut-peer'])
  await page.locator('[data-case="own"] .fp-avatar-frame').click()
  assert.equal(await page.evaluate(() => window.avatarNavigations.at(-1)), '/member/Yui', '本人头像单击保持直接导航')
  assert.deepEqual(await page.evaluate(() => window.mentions), ['shortcut-peer'])
  await message.dblclick({ position: { x: 3, y: 3 } })
  assert.deepEqual(await page.evaluate(() => window.quickQuotes), ['shortcuts'])
  const textBox = shortcut.locator('.body p').first()
  const point = await textBox.evaluate(el => {
    const range = document.createRange()
    range.setStart(el.firstChild, 2)
    range.setEnd(el.firstChild, 3)
    const rect = range.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  })
  await page.mouse.dblclick(point.x, point.y)
  assert.equal(await page.evaluate(() => getSelection()?.toString()), 'Selection', '正文双击保留浏览器选词')
  await shortcut.getByRole('link', { name: '链接' }).dblclick()
  assert.equal(new URL(page.url()).hash, '#normal-link')
  await imageQuote.locator('.chat-quote-author').dblclick()
  assert.equal(new URL(page.url()).hash, '#normal-link', '双击引用摘要仍不跳转原消息')
  await page.locator('[data-case="mixed-media"] .body img').click()
  await lightbox.waitFor()
  await page.keyboard.press('Escape')
  await lightbox.waitFor({ state: 'hidden' })
  await page.locator('[data-case="standalone"] .fp-bubble').dblclick({ position: { x: 3, y: 3 } })
  assert.deepEqual(await page.evaluate(() => window.quickQuotes), ['shortcuts'], '控件、图片和独立卡片不触发快捷引用')
  await page.evaluate(() => { window.shortcutsEnabled = false })
  await message.dblclick({ position: { x: 3, y: 3 } })
  assert.deepEqual(await page.evaluate(() => window.quickQuotes), ['shortcuts'])
  const touchPage = await browser.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true })
  await touchPage.route('http://quotes.test/**', route => route.fulfill({ contentType: 'text/html', body: html }))
  await touchPage.goto('http://quotes.test/cr')
  await touchPage.locator('[data-case="shortcuts"] .fp-avatar-frame').tap()
  assert.deepEqual(await touchPage.evaluate(() => window.avatarNavigations), ['/member/shortcut-peer'], '触屏单击头像立即导航')
  assert.deepEqual(await touchPage.evaluate(() => window.mentions), [])
  await touchPage.close()
  console.log('PASS 快捷操作实测：头像单击、键盘、触屏和双击分流，正文空白双击引用，保留选词、链接、图片和独立卡片')
  assert.deepEqual(errors, [])
  assert.equal(requests.filter(url => /\/api\//.test(url)).length, 0, '渲染引用不能触发详情补查')
  for (const [file, count] of [
    ['src/views/ChatroomView.vue', 2],
    ['src/components/chat/WhisperConversations.vue', 1],
    ['src/components/chat/HiddenChatConversations.vue', 1],
    ['src/components/chat/ChatContextPanel.vue', 1],
  ]) {
    assert.equal((fs.readFileSync(file, 'utf8').match(/:source="(?:entry\.message|line|message)\.content"/g) || []).length, count, file)
  }
  console.log('PASS 引用气泡实测：本人/他人、旧链接/清洗链接、图片/清风/纯引用、手写保留、320px至桌面单行省略、回跳/移除、无补查及全部消费者接线')
} finally {
  await browser.close()
}
