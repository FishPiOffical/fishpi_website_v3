import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = 'http://chat-context.test'
const files = new Map()
const modules = new Map()
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
function publish(name, code) {
  const url = `${origin}/modules/${name}.js`
  files.set(new URL(url).pathname, code)
  return url
}
const vue = publish('vue', fs.readFileSync('node_modules/vue/dist/vue.esm-browser.prod.js', 'utf8'))
modules.set('vue', vue)
const router = publish('router', fs.readFileSync('node_modules/vue-router/dist/vue-router.esm-browser.prod.js', 'utf8').replace(/from\s*["']vue["']/g, `from '${vue}'`))
modules.set('vue-router', router)
const mocks = publish('mocks', `import { reactive, ref, toRefs, h } from '${vue}';
export const auth=reactive({accessToken:'fixture-token',isLoggedIn:true,account:{oId:'1',userName:'本人'}});
export const prefs=reactive({simpleMode:false,blurChatImages:false,sendShortcut:'enter'});
export const timeline=reactive({changeHint:null,notices:[]});
export const publication=reactive({pending:null,receipt:null});
export const chat=reactive({messages:[],sending:false,loading:false,loadingMore:false,hasMore:false,error:'',topicError:'',discuss:'本地引用定位专项',onlineTotal:1,nodeName:'本地夹具',nodeOptions:[],chatStyle:'classic',connecting:false,
 acquire(){window.acquired=(window.acquired||0)+1},release(){},loadMore(){window.mainLoads++},refreshMessages(){window.mainReads++},send(){throw Error('禁止测试发消息')},clearScreen(){},toggleChatStyle(){this.chatStyle=this.chatStyle==='classic'?'modern':'classic'}});
window.auth=auth;window.timeline=timeline;window.chat=chat;window.mainLoads=0;window.mainReads=0;window.apiRequests=[];window.resolvedRequests=[];
export const storeToRefs=toRefs,useAuthStore=()=>auth,useChatPreferencesStore=()=>prefs,useFunctionPreferencesStore=()=>prefs,useChatStore=()=>chat,useV3ChatTimelineStore=()=>timeline,useV3ChatPublicationStore=()=>publication;
export const useChatFilterStore=()=>({modeFor:()=> 'show'});
export const useChatMessageSource=()=>({quote:ref(null),quoteBusy:ref(''),quoteErr:ref(''),quoteMessage(){},clearQuote(){},buildQuoteSuffix:()=>''});
export const CHAT_MENTION=Symbol(),chatMentionText=x=>x;
export const getAuthContextVersion=()=>1,formatDisplayTime=()=> '2026-11-14 13:07';
export class ApiError extends Error {constructor(message,status){super(message);this.status=status}}
export async function request(url,options={}){
 window.apiRequests.push(url);
 // 故意忽略取消信号，验证真实 composable 仍会拒绝已迟到的旧窗口响应。
 const response=await fetch(url,{cache:'no-store'});const value=await response.json();window.resolvedRequests.push(url);
 if(!response.ok)throw new ApiError(value.message,response.status);return value;
}
export default {props:['open'],setup(p,{slots}){return()=>p.open===false?null:slots.default?.()||null}};
`)
for (const name of ['pinia', '@/stores/auth', '@/stores/chatPreferences', '@/stores/functionPreferences', '@/stores/v3ChatTimeline', '@/stores/v3ChatPublication', '@/stores/chatFilter', '@/composables/useChatMessageSource', '@/chat/mention', '@/api/http', '@/utils/time']) modules.set(name, mocks)
modules.set('@/components/ChatComposer.vue', publish('composer', `import {h} from '${vue}';export default {props:['modelValue','height'],setup(p,{slots,expose}){expose({flush:()=>p.modelValue,reveal(){document.querySelector('[data-editor]')?.focus()},insert(){}});return()=>h('div',{class:'fixture-composer'},[slots.top?.(),h('textarea',{'data-editor':'true','aria-label':'聊天输入框',value:p.modelValue,style:{height:(p.height||100)+'px'}}),h('div',{class:'bar'},[slots.tools?.(),slots['inline-context']?.(),slots.actions?.()])])}}`))
const noop = publish('noop', 'export default {setup(){return()=>null}}')
for (const name of ['ChatToolDialog', 'ChatRoomNotice', 'ChatConnectionStatus', 'ChatRepeatAction', 'ChatRevokeAction', 'ChatRevokeRecovery', 'ChatPublicationRecovery', 'ChatTopicEditor', 'ChatTopicRecovery', 'ChatOnlineList', 'ChatRedPacketCard', 'CollectChatEmoji']) modules.set(`@/components/chat/${name}.vue`, noop)
for (const name of ['ChatCard', 'V3ReactionBar', 'ReportDialog', 'FpLoading', 'ImageLightbox']) modules.set(`@/components/${name}.vue`, noop)
modules.set('@/chat/sidebar/ChatSidebar.vue', publish('sidebar', `import{h}from'${vue}';export default {setup:()=>()=>h('p',{'data-sidebar':'true'},'侧栏仍可操作')}`))
modules.set('@/components/FpDialog.vue', mocks)
modules.set('@/components/medal/MedalList.vue', noop)
modules.set('@/components/user/VipNickname.vue', mocks)
let css = ''
function rewrite(code, filename) {
  return code.replace(/import\.meta\.env\.SSR/g, 'false').replace(/\bfrom\s+(['"])([^'"]+)\1/g, (_, quote, specifier) => {
    let target = specifier
    if (specifier.startsWith('.')) target = '@/' + path.posix.normalize(path.posix.join(path.posix.dirname(filename.replace(/^src\//, '')), specifier))
    target = target.replace(/\.ts$/, '')
    const resolved = modules.get(target)
    if (!resolved) throw Error(`缺少浏览器夹具依赖：${filename} → ${target}`)
    return `from '${resolved}'`
  })
}
function compileTs(file) {
  const key = '@/' + file.replace(/^src\//, '').replace(/\.ts$/, '')
  modules.set(key, publish(key.slice(2).replaceAll('/', '-'), rewrite(transpile(fs.readFileSync(file, 'utf8')), file)))
}
function compileVue(file) {
  const id = 'data-v-' + path.basename(file, '.vue').toLowerCase()
  const { descriptor } = parse(fs.readFileSync(file, 'utf8'))
  const script = rewrite(transpile(compileScript(descriptor, { id, inlineTemplate: true }).content), file).replace('export default', 'const component =')
  for (const style of descriptor.styles) {
    const result = compileStyle({ source: style.content, filename: file, id, scoped: true, preprocessLang: style.lang })
    assert.deepEqual(result.errors, [], file)
    css += result.code + '\n'
  }
  const url = publish(path.basename(file), script + `;component.__scopeId='${id}';export default component;`)
  modules.set('@/' + file.replace(/^src\//, ''), url)
  return url
}
// 消息解码、窗口读取、引用气泡、完整聊天室模板和布局都由仓库源码编译。
for (const name of ['avatar', 'chatAppearance', 'chatMessage', 'chatQuote', 'chatRepeatGroups', 'chatScrollFollow']) compileTs(`src/utils/${name}.ts`)
compileTs('src/api/v3-reactions.ts')
compileTs('src/api/v3-chat-messages.ts')
compileTs('src/composables/useChatContext.ts')
compileTs('src/composables/useChatQuoteNavigation.ts')
compileTs('src/composables/useChatScrollFollow.ts')
compileTs('src/composables/useScrollPagination.ts')
const chatSource = fs.readFileSync('src/stores/chat.ts', 'utf8')
const projection = chatSource.slice(chatSource.indexOf('export function asV3Line'), chatSource.indexOf("export const useChatStore"))
modules.set('@/stores/chat', publish('chat', transpile(projection) + `\nexport {useChatStore} from '${mocks}';`))
compileVue('src/components/chat/ChatQuoteCard.vue')
compileVue('src/components/chat/ChatQuotePreview.vue')
compileVue('src/components/ChatBubble.vue')
compileVue('src/components/chat/ChatContextPanel.vue')
compileVue('src/components/chat/ChatRepeatList.vue')
compileVue('src/components/chat/ChatMessageEntry.vue')
const view = compileVue('src/views/ChatroomView.vue')
const avatar = 'data:image/png;base64,' + fs.readFileSync('public/images/user-thumbnail.png').toString('base64')
function message(id, quoteId = '') {
  const body = `消息 ${id}：这是本地隔离的历史窗口正文，用于验证实际气泡和引用定位。`
  const quote = quoteId ? `<h5>引用 @测试用户 <a href="/cr#chatroom${quoteId}">↩</a></h5><blockquote><p>查看消息 ${quoteId}</p></blockquote>` : ''
  return { id: String(id), createdAt: 1763111220000 + Number(id), type: 'text', content: body, contentHtml: `<p>${body}</p><p>第二行真实布局内容，保留自然消息高度。</p>${quote}`, author: { id: '2', userName: '测试用户', userNickname: '测试昵称', userAvatarURL: avatar }, client: 'Web', card: {} }
}
const initial = [message('9001', '100'), message('9002', '200')]
// 复用生产路由的滚动行为，防止夹具默认行为掩盖 hash 抢滚动问题。
const routerSource = ts.createSourceFile('router.ts', fs.readFileSync('src/router/index.ts', 'utf8'), ts.ScriptTarget.Latest, true)
let scrollBehavior = ''
function findScrollBehavior(node) {
  if (ts.isMethodDeclaration(node) && node.name.getText(routerSource) === 'scrollBehavior') scrollBehavior = node.getText(routerSource)
  ts.forEachChild(node, findScrollBehavior)
}
findScrollBehavior(routerSource)
assert.ok(scrollBehavior, '必须使用实际路由滚动行为')
const html = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;font:14px system-ui;background:#f4f6f8;--fp-card:#fff;--fp-border:#dfe4e9;--fp-text:#252a31;--fp-title:#252a31;--fp-muted:#737c89;--fp-primary:#62ae37;--fp-accent:#4d9633;--fp-accent-soft:#edf4e7;--fp-hover:#f4f6f8;--fp-bg:#f5f6f8;--fp-self:#edf4e7;--fp-avatar-radius:8px;--fp-link:#3977c8;--fp-nav-h:58px;--fp-page-gap:20px;--fp-panel-padding:20px;--fp-panel-radius:12px}
header.fixture-nav{height:58px;position:fixed;top:0;inset-inline:0;background:#fff;border-bottom:1px solid #ddd;z-index:50;padding:16px}#app{max-width:1200px;margin:70px auto 0;padding:0 12px}.fixture-composer textarea{display:block;width:100%;resize:none;border:1px solid #ddd;border-radius:7px;padding:10px;font:inherit}.fixture-composer .bar{display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-height:40px}.fixture-composer button{cursor:pointer}a{color:inherit}${css}
</style><header class="fixture-nav">聊天室引用定位 · 只读本地夹具</header><div id="app"></div><script type="module">
import {createApp,h} from '${vue}';import {createRouter,createWebHistory,RouterView} from '${router}';import View from '${view}';import {chat} from '${mocks}';import {asV3Line} from '${modules.get('@/stores/chat')}';
chat.messages=${JSON.stringify(initial)}.map(asV3Line);chat.chatStyle=new URLSearchParams(location.search).get('mode')||'classic';
const router=createRouter({history:createWebHistory(),routes:[{path:'/cr',component:View}],${scrollBehavior}});window.fixtureRouter=router;
window.addRealtime=()=>chat.messages.push(asV3Line(${JSON.stringify(message('9999'))}));
createApp({render:()=>h(RouterView)}).use(router).mount('#app');window.fixtureReady=true;
</script>`

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const errors = [], unexpected = []
let delayedRelease, imageRelease
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  page.setDefaultTimeout(10000)
  page.on('pageerror', e => { errors.push(e.message); console.error('浏览器错误：', e.message) })
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) { unexpected.push(url.href); await route.abort(); return }
    if (files.has(url.pathname)) { await route.fulfill({ contentType: 'text/javascript', body: files.get(url.pathname) }); return }
    if (url.pathname === '/cr') { await route.fulfill({ contentType: 'text/html', body: html }); return }
    if (url.pathname === '/delayed.svg') {
      await new Promise(resolve => { imageRelease = resolve })
      await route.fulfill({ contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800"><rect width="400" height="800" fill="#b8d8ee"/></svg>' }); return
    }
    const match = /^\/api\/v3\/chat\/messages\/(\d+)\/context$/.exec(url.pathname)
    if (match) {
      const id = match[1]
      assert.equal(url.searchParams.get('radius'), '5')
      if (id === '700') await new Promise(resolve => { delayedRelease = resolve })
      if (id === '403' || id === '404') { await route.fulfill({ status: Number(id), json: { message: id === '403' ? '当前身份无权读取聊天记录' : '消息不存在或已不可读取' } }); return }
      if (id === '422') { await route.fulfill({ json: { code: 0, data: { anchorId: id, list: [] } } }); return }
      const list = Array.from({ length: 11 }, (_, n) => message(Number(id) - 5 + n, n === 5 ? (id === '100' ? '200' : '100') : ''))
      if (id === '1100') for (const item of list) if (item.id !== id) item.contentHtml = '<p><img src="/delayed.svg" alt="延迟图片"></p>'
      await route.fulfill({ json: { code: 0, data: { anchorId: id, list, hasMoreBefore: true, hasMoreAfter: true, nextBefore: list[0].id, nextAfter: list.at(-1).id } } }); return
    }
    if (url.pathname === '/api/v3/chat/messages') {
      assert.equal(url.searchParams.get('size'), '10')
      const before = url.searchParams.get('before'), after = url.searchParams.get('after')
      const start = before ? Number(before) - 10 : Number(after) + 1
      const list = Array.from({ length: 10 }, (_, n) => message(start + n, n === 5 ? '100' : ''))
      await route.fulfill({ json: { code: 0, data: { list, hasMore: true, nextBefore: list[0].id, nextAfter: list.at(-1).id } } }); return
    }
    unexpected.push(url.href); await route.abort()
  })
  const calls = () => page.evaluate(() => [...window.apiRequests])
  async function anchorVisible(id, contained) {
    await page.waitForSelector(`.chat-context li#chatroom${id}[data-anchor="true"]`)
    await page.waitForFunction(({ id, contained }) => {
      const el = document.getElementById('chatroom' + id), box = el?.getBoundingClientRect()
      const area = document.querySelector('.chat-context')?.getBoundingClientRect()
      return box && area && box.top >= (contained ? area.top : 58) && box.bottom <= (contained ? area.bottom : innerHeight)
    }, { id, contained }).catch(async error => {
      const layout = await page.evaluate(id => {
        const anchor = document.getElementById('chatroom' + id), area = document.querySelector('.chat-context')
        const bounds = element => { const rect = element?.getBoundingClientRect(); return rect && { top: rect.top, bottom: rect.bottom, height: rect.height } }
        return { anchor:bounds(anchor), area:bounds(area), scrollTop:area?.scrollTop, pageY:scrollY, height:innerHeight }
      }, id)
      await page.screenshot({ path:'/tmp/chat-context-failure.png', fullPage:false })
      throw new Error(`目标消息 ${id} 不在可视区域：${JSON.stringify(layout)}`, { cause:error })
    })
    assert.equal(await page.locator('[role="dialog"], [aria-modal="true"], .fp-dialog-mask, .modal-overlay').count(), 0, '历史窗口不能变成模态弹窗')
    assert.equal(await page.locator('.chat-context li').count(), 11, '首次只显示目标及前后各五条')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '历史窗口不横向溢出')
  }
  for (const mode of ['classic', 'modern']) for (const width of [1200, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${origin}/cr?mode=${mode}`)
    await page.waitForSelector('#chatroom9001 .chat-quote-card')
    const y = await page.evaluate(() => scrollY)
    await page.locator('#chatroom9001 .chat-quote-card').click()
    await anchorVisible('100', mode === 'modern')
    assert.deepEqual(await calls(), ['/api/v3/chat/messages/100/context?radius=5'], '引用跳转不得扫描主历史页')
    const ids = await page.locator('.chat-context li').evaluateAll(nodes => nodes.map(n => n.id))
    assert.equal(ids[0], mode === 'classic' ? 'chatroom105' : 'chatroom95')
    if (width === 390) await page.screenshot({ path: `/tmp/chat-context-${mode}-390.png`, fullPage: false })
    if (mode === 'modern') {
      assert.equal(await page.evaluate(() => scrollY), y, '简约定位不得滚动页面')
      const box = await page.locator('[data-editor]').boundingBox()
      assert.ok(box.y >= 58 && box.y + box.height <= 900, '简约模式编辑器须保持可见')
      const before = await page.locator('.chat-context').evaluate(el => el.scrollTop)
      await page.locator('.chat-context').hover()
      await page.mouse.wheel(0, 300)
      await page.waitForFunction(top => document.querySelector('.chat-context').scrollTop > top, before)
      assert.equal(await page.evaluate(() => scrollY), y, '简约回看只滚消息区域')
    } else assert.ok(await page.evaluate(() => scrollY) > y, '经典模式应使用页面定位')
    await page.evaluate(() => window.addRealtime())
    await page.getByRole('button', { name: '回到最新消息' }).click()
    await page.waitForSelector('#chatroom9999')
    assert.equal(new URL(page.url()).hash, '')
    assert.equal(await page.locator('#chatroom9001, #chatroom9002, #chatroom9999').count(), 3, '返回保留原列表和历史查看期间的新消息')
    assert.equal(await page.evaluate(() => window.mainReads + window.mainLoads), 0, '返回最新不得重扫主消息窗口')
    assert.equal((await calls()).length, 1)
  }
  await page.setViewportSize({ width: 1200, height: 900 })
  await page.goto(`${origin}/cr?mode=modern`)
  await page.locator('#chatroom9001 .chat-quote-card').click()
  await anchorVisible('100', true)
  await page.locator('#chatroom100 .chat-quote-card').click()
  await anchorVisible('200', true)
  assert.deepEqual(await calls(), ['/api/v3/chat/messages/100/context?radius=5', '/api/v3/chat/messages/200/context?radius=5'])
  await page.evaluate(() => window.fixtureRouter.push({hash:'#chatroom700'}))
  await page.waitForFunction(() => window.apiRequests.some(url=>url.includes('/700/context')))
  await page.evaluate(() => window.fixtureRouter.push({hash:'#chatroom800'}))
  await anchorVisible('800', true)
  delayedRelease()
  await page.waitForFunction(() => window.resolvedRequests.some(url=>url.includes('/700/context')))
  assert.equal(await page.locator('#chatroom700').count(), 0, '迟到窗口不能覆盖当前引用')
  assert.equal(await page.locator('#chatroom800[data-anchor="true"]').count(), 1)
  for (const [id, text] of [['403', '当前身份无权读取聊天记录'], ['404', '消息不存在或已不可读取'], ['422', '聊天室消息响应不正确']]) {
    await page.evaluate(id => window.fixtureRouter.push({hash:'#chatroom'+id}), id)
    await page.getByRole('alert').filter({hasText:text}).waitFor()
    assert.equal(await page.locator('.chat-context li').count(), 0, '权限及无效响应不能保留旧正文')
    assert.equal(await page.getByRole('button', { name: '重新加载聊天记录' }).count(), 1)
  }
  await page.evaluate(() => window.fixtureRouter.push({hash:'#chatroom100'}))
  await anchorVisible('100', true)
  const beforePage = (await calls()).length
  await page.getByRole('button', { name: '查看更早消息', exact: true }).click()
  await page.waitForSelector('#chatroom85')
  assert.equal(await page.locator('.chat-context li').count(), 10)
  assert.equal((await calls()).at(-1), '/api/v3/chat/messages?size=10&before=95')
  await page.locator('#chatroom90 .chat-quote-card').click()
  await anchorVisible('100', true)
  assert.equal((await calls()).length, beforePage + 2, '翻页后同一 hash 引用只重读一次定位窗口')
  await page.screenshot({ path: '/tmp/chat-context-modern-1200.png', fullPage: false })
  // 先确认真实目标已定位，再让所有邻居图片完成加载，检验布局变化是否挪走目标。
  for (const mode of ['modern', 'classic']) {
    await page.goto(`${origin}/cr?mode=${mode}`)
    await page.waitForSelector('#chatroom9001')
    await page.evaluate(() => window.fixtureRouter.push({hash:'#chatroom1100'}))
    await anchorVisible('1100', mode === 'modern')
    imageRelease()
    await page.waitForFunction(() => [...document.querySelectorAll('.chat-context .body img')].every(img => img.complete && img.naturalHeight > 0))
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await anchorVisible('1100', mode === 'modern')
  }
  // 用户已经主动回看时，图片加载不应再把消息区拉回原锚点。
  await page.goto(`${origin}/cr?mode=modern`)
  await page.waitForSelector('#chatroom9001')
  await page.evaluate(() => window.fixtureRouter.push({hash:'#chatroom1100'}))
  await anchorVisible('1100', true)
  const lockedTop = await page.locator('.chat-context').evaluate(el => el.scrollTop)
  await page.locator('.chat-context').hover()
  await page.mouse.wheel(0, -100)
  await page.waitForFunction(top => document.querySelector('.chat-context').scrollTop < top, lockedTop)
  const userTop = await page.locator('.chat-context').evaluate(el => el.scrollTop)
  imageRelease()
  await page.waitForFunction(() => [...document.querySelectorAll('.chat-context .body img')].every(img => img.complete && img.naturalHeight > 0))
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  assert.equal(await page.locator('.chat-context').evaluate(el => el.scrollTop), userTop, '主动滚动后图片加载不得抢回锚点')
  assert.deepEqual(errors, [], '浏览器不应有未处理错误')
  assert.deepEqual(unexpected, [], '全部网络必须留在本地隔离夹具')
  console.log('PASS 引用内联历史浏览器专项：真实页面/窗口/API、经典及简约 1200/390/320px、目标真实 DOM 可见、无模态、简约仅内部滚动且保留输入框、一次前后各五条、引用切换与迟到隔离、返回保留实时消息、权限/不存在/坏响应、手动分页与同 hash 重新定位、延迟图片保持锚点及主动滚动后解锁；未请求现网或发消息。')
} finally {
  delayedRelease?.()
  imageRelease?.()
  await browser.close()
}
