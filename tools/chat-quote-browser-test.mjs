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
export const RouterLink={props:['to'],setup(p,{slots}){return()=>h('a',{href:p.to},slots.default?.())}};`)
const modules = { vue, 'vue-router': mocks }
for (const path of ['@/stores/auth', '@/stores/chatPreferences', '@/stores/functionPreferences', '@/chat/mention', '@/api/v3-chat-messages', '@/utils/time']) modules[path] = mocks
for (const name of ['avatar', 'chatAppearance', 'chatMessage', 'chatQuote']) {
  modules['@/utils/' + name] = data(transpile(fs.readFileSync(`src/utils/${name}.ts`, 'utf8')))
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
modules['@/components/chat/ChatQuoteCard.vue'] = compile('src/components/chat/ChatQuoteCard.vue', 'data-v-quote-card')
modules['./ChatQuoteCard.vue'] = modules['@/components/chat/ChatQuoteCard.vue']
const preview = compile('src/components/chat/ChatQuotePreview.vue', 'data-v-quote-preview')
const bubble = compile('src/components/ChatBubble.vue', 'data-v-bubble')
const avatar = 'data:image/png;base64,' + fs.readFileSync('public/images/user-thumbnail.png').toString('base64')
const excerpt = '第一行正文，保留引用内容。第二行正文很长很长，应该保持单行省略而不能撑开聊天窗口。'
const source = `1\n\n##### 引用 @Yui [↩](/cr#chatroom123 "跳转至原消息")  \n> ${excerpt}\n> 第三行引用\n`
const stripped = `<p>1</p><h5>引用 @Yui <a title="跳转至原消息">↩</a></h5><blockquote><p>${excerpt}<br>第三行引用</p></blockquote>`
const linked = '<p>这是旧版的消息</p><h5>引用 @小羊 <a href="https://fishpi.cn/cr#chatroom456">↩</a></h5><blockquote><p>普通引用内容<br>还有一行</p></blockquote>'
const fixtures = [
  { id: 'own', userName: 'Yui', self: true, html: stripped, source },
  { id: 'other', userName: '冰岚', html: stripped, source },
  { id: 'classic', userName: '小羊', html: linked },
  { id: 'image', userName: '图片引用', html: '<p>看图</p><h5>引用 @Yui <a href="/cr#chatroom789">↩</a></h5><blockquote><p><img src="https://file.fishpi.cn/test.png"></p></blockquote>' },
  { id: 'only', userName: '只有引用', html: linked.replace('<p>这是旧版的消息</p>', '') },
  { id: 'hand', userName: '手写引用', html: '<p>我的正文</p><blockquote><p>没有来源的普通引用</p></blockquote>' },
  { id: 'moon', userName: '清风', html: '<p>分享</p><blockquote><p><a href="https://fishpi.cn/member/Yui/breezemoons/123">清风明月 · Yui</a></p><p>快点放假吧</p></blockquote>' },
]
const packs = fs.readFileSync('src/packs/bubbles/star-route/style.css', 'utf8')
const html = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;font:14px system-ui;background:#f4f6f8;--fp-card:#fff;--fp-border:#dfe4e9;--fp-text:#252a31;--fp-muted:#737c89;--fp-primary:#62ae37;--fp-hover:#f4f6f8;--fp-bg:#f5f6f8;--fp-self:#edf4e7;--fp-avatar-radius:8px;--fp-link:#3977c8}
a{color:inherit}.panel{padding:20px;background:white;max-width:760px;margin:16px auto}.case{margin:16px 0 24px}.title{font-size:12px;color:#7b8390;margin-bottom:12px}${css}${packs}
</style><div id="app"></div><script type="module">
import {createApp,h,ref} from '${vue}';import Bubble from '${bubble}';import Preview from '${preview}';
const fixtures=${JSON.stringify(fixtures)};const narrow=ref(false);window.narrow=narrow;
createApp({setup:()=>()=>h('div',{class:'panel'},[
...fixtures.map(f=>h('section',{class:'case','data-case':f.id},[h('div',{class:'title'},f.id),h(Bubble,{...f,chatroom:true,userId:f.self?'me':'other',avatar:'${avatar}',avatarSize:narrow.value?24:36,appearance:{bubbleId:'star-route',frameId:'none',version:1}})])),
h('section',{class:'case','data-case':'preview'},[h(Preview,{quotes:[{kind:'message',href:'/cr#chatroom123',author:'Yui',excerpt:${JSON.stringify(excerpt)}}],onRemove:()=>window.removed=true})])
])}).mount('#app');
</script>`

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1300 } })
  const errors = [], requests = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('request', r => requests.push(r.url()))
  await page.route('http://quotes.test/**', r => r.fulfill({ contentType: 'text/html', body: html }))
  await page.goto('http://quotes.test/cr')
  await page.waitForSelector('[data-case="own"] .chat-quote-card')
  for (const id of ['own', 'other', 'classic', 'image', 'only', 'moon']) {
    const section = page.locator(`[data-case="${id}"]`)
    assert.equal(await section.locator('.chat-quote-card').count(), 1, id)
    assert.equal(await section.locator('.fp-bubble .chat-quote-card, .fp-bubble h5').count(), 0, id)
  }
  assert.equal(await page.locator('[data-case="own"] .body').innerText(), '1')
  assert.equal(await page.locator('[data-case="image"] .chat-quote-excerpt').innerText(), '图片消息')
  assert.equal(await page.locator('[data-case="only"] .fp-bubble').count(), 0)
  assert.equal(await page.locator('[data-case="hand"] .body blockquote').innerText(), '没有来源的普通引用')
  for (const width of [1000, 560, 390, 320]) {
    await page.setViewportSize({ width, height: 1600 })
    await page.evaluate(() => { narrow.value = innerWidth < 560 })
    await page.waitForTimeout(60)
    const overflow = await page.evaluate(() => [...document.querySelectorAll('body *:not(script):not(style)')]
      .filter(el => el.getBoundingClientRect().right > innerWidth || el.getBoundingClientRect().left < 0)
      .map(el => ({ element: el.className, case: el.closest('[data-case]')?.getAttribute('data-case'), left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `页面横向溢出：${width} ${JSON.stringify(overflow)}`)
    for (const id of ['own', 'other', 'classic', 'image']) {
      const layout = await page.locator(`[data-case="${id}"] .chat-quote-card`).evaluate(el => {
        const preview = el.querySelector('.chat-quote-excerpt'), style = getComputedStyle(preview)
        const body = el.closest('.message-stack').querySelector('.fp-bubble').getBoundingClientRect()
        const r = el.getBoundingClientRect()
        return { whitespace: style.whiteSpace, ellipsis: style.textOverflow, height: r.height, top: r.top, bodyBottom: body.bottom, clipped: preview.scrollWidth > preview.clientWidth }
      })
      assert.equal(layout.whitespace, 'nowrap')
      assert.equal(layout.ellipsis, 'ellipsis')
      assert.ok(layout.top >= layout.bodyBottom, `${id} 引用应在气泡下方`)
      assert.ok(layout.height < 40, `${id} 必须保持单行高度`)
      if (id === 'own') assert.ok(layout.clipped, '长引用应省略')
    }
  }
  await page.screenshot({ path: '/tmp/chat-quotes-320.png', fullPage: true })
  await page.setViewportSize({ width: 1000, height: 1200 })
  await page.screenshot({ path: '/tmp/chat-quotes-1000.png', fullPage: true })
  await page.locator('[data-case="own"] .chat-quote-card').click()
  assert.equal(new URL(page.url()).hash, '#chatroom123')
  await page.locator('[data-case="preview"] button').click()
  assert.equal(await page.evaluate(() => window.removed), true)
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
