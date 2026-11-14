import assert from 'node:assert/strict';import fs from 'node:fs/promises';import ts from 'typescript';import{effectScope,ref,nextTick}from'vue';import{createPinia,defineStore,setActivePinia}from'pinia'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),replace=(s,pairs)=>{for(const[a,b]of pairs)s=s.replaceAll(`from '${a}'`,`from '${b}'`);return s}
const state=globalThis.__chatSource={context:1,calls:[],dispatch:null};const http=url(`export class ApiError extends Error{constructor(m,status=0){super(m);this.status=status}}export function getAuthContextVersion(){return globalThis.__chatSource.context}export async function request(path,init){globalThis.__chatSource.calls.push({path,init});return globalThis.__chatSource.dispatch(path,init)}`),{ApiError}=await import(http),apiURL=url(compile(await fs.readFile('src/api/v3-chat-messages.ts','utf8')).replace("from '@/utils/chatAppearance'",`from '${url(compile(await fs.readFile('src/utils/chatAppearance.ts','utf8')))}'`).replaceAll("'./v3-reactions'", "'"+url(compile(await fs.readFile('src/api/v3-reactions.ts','utf8')).replace("from './http'",`from '${http}'`))+"'").replace("from './http'",`from '${http}'`)),api=await import(apiURL)
const auth=defineStore('source-auth',()=>({accessToken:ref('A'),account:ref({oId:'1'})}));globalThis.__chatSourceAuth=auth;const authURL=url('export const useAuthStore=globalThis.__chatSourceAuth'),source=await fs.readFile('src/composables/useChatMessageSource.ts','utf8'),hookURL=ssr=>url(replace(compile(source.replaceAll('import.meta.env.SSR',String(ssr))),[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/api/http',http],['@/api/v3-chat-messages',apiURL],['@/stores/auth',authURL]])),{useChatMessageSource}=await import(hookURL(false)),env=data=>({code:0,data}),tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve();await nextTick()}
const base={id:'2',createdAt:2,type:'text',content:'raw **Markdown**\nsecond line',contentHtml:'<p>current clean HTML</p>',author:{id:'8',userName:'other',userNickname:'public',userAvatarURL:''},client:'Web/Website',card:{}}
function setup(){const pinia=createPinia();setActivePinia(pinia);const scope=effectScope();let model;scope.run(()=>model=useChatMessageSource());return{scope,model,user:auth(pinia)}}
state.dispatch=async()=>env({...base,userPassword:'SECRET',transport:{apiKey:'SECRET'}});assert.deepEqual(await api.chatMessageDetail('2'),base);assert.equal(state.calls.at(-1).path,'/api/v3/chat/messages/2');assert.equal(state.calls.at(-1).init.cache,'no-store');assert.ok(!JSON.stringify(await api.chatMessageDetail('2')).includes('SECRET'))
console.log('PASS chat source 1 actual detail uses exact v3 path, whitelist and no-store')
for(const payload of [{...base,id:'3'},{...base,createdAt:-1},{...base,type:'bad'},{...base,author:{...base.author,id:'bad'}}]){state.dispatch=async()=>env(payload);await assert.rejects(api.chatMessageDetail('2'),e=>e.status===502)}const before=state.calls.length;await assert.rejects(api.chatMessageDetail('bad'),e=>e.status===422);assert.equal(state.calls.length,before)
console.log('PASS chat source 2 wrong target/types/IDs fail closed and bad request makes no HTTP call')
const card={...base,type:'music',content:'SECRET_SOURCE',contentHtml:'SECRET_SOURCE',card:{title:'<literal>',source:'123',coverURL:'',from:'netease',gesture:1,token:'SECRET'}};state.dispatch=async()=>env(card);const projected=await api.chatMessageDetail('2');assert.ok(!JSON.stringify(projected).includes('SECRET'));assert.match(api.chatSourceText(projected),/卡片公开摘要/);assert.match(api.chatSourceText(projected),/<literal>/);state.dispatch=async()=>env({...base,type:'unavailable',content:'SECRET',author:{userName:'SECRET'}});const unavailable=await api.chatMessageDetail('2');assert.ok(!JSON.stringify(unavailable).includes('SECRET'));assert.throws(()=>api.chatSourceText(unavailable),e=>e.status===404)
console.log('PASS chat source 3 cards expose selected public fields only; unavailable messages cannot become raw text or author proof')
state.dispatch=async()=>env(base);let view=setup();await view.model.quoteMessage('2');assert.equal(view.model.quote.value.html,base.contentHtml);assert.equal(view.model.quote.value.content,base.content);assert.match(view.model.buildQuoteSuffix(),/\n> second line/);assert.match(view.model.buildQuoteSuffix(),/\[↩\]\(https:\/\/fishpi\.cn\/cr#chatroom2 "跳转至原消息"\)/);await view.model.showRaw('2');assert.equal(view.model.rawText.value,base.content);assert.equal(view.model.rawOpen.value,true);view.scope.stop()
console.log('PASS chat source 4 actual lifecycle uses current HTTP raw/clean preview and quotes every source line')
state.dispatch=async()=>env({...base,tail:{text:'不进入引用的小尾巴'}});view=setup();await view.model.quoteMessage('2');assert.ok(!view.model.buildQuoteSuffix().includes('不进入引用的小尾巴'));await view.model.showRaw('2');assert.equal(view.model.rawText.value,base.content);view.scope.stop()
console.log('PASS 小尾巴独立于引用与原文，不重复带入下一条消息')
state.dispatch=async()=>env({...base,author:{...base.author,userName:'[x](bad)'}});view=setup();await view.model.quoteMessage('2');assert.match(view.model.buildQuoteSuffix(),/@\\\[x\\\]/);view.scope.stop()
console.log('PASS chat source 5 author display text escaped before Markdown quote header interpolation')
let finish;state.dispatch=()=>new Promise(r=>finish=r);view=setup();const quoting=view.model.quoteMessage('2');await tick();const signal=state.calls.at(-1).init.signal;view.model.clearQuote();assert.equal(signal.aborted,true);finish(env(base));await quoting;assert.equal(view.model.quote.value,null);view.scope.stop()
console.log('PASS chat source 6 cancel aborts quote and late response cannot reselect it')
view=setup();const reading=view.model.showRaw('2');await tick();const rawSignal=state.calls.at(-1).init.signal;view.model.closeRaw();finish(env(base));await reading;assert.equal(rawSignal.aborted,true);assert.equal(view.model.rawOpen.value,false);assert.equal(view.model.rawText.value,'');view.scope.stop()
console.log('PASS chat source 7 closing raw dialog aborts and late response cannot reopen private content')
view=setup();const rotating=view.model.quoteMessage('2');await tick();view.user.accessToken='normally-rotated';finish(env(base));await rotating;assert.equal(view.model.quote.value.content,base.content);view.user.accessToken=null;assert.equal(view.model.quote.value,null);assert.equal(view.model.rawText.value,'');view.scope.stop()
console.log('PASS chat source 8 same-owner token rotation preserves pending source, logout clears prior quote/raw')
view=setup();const obsolete=view.model.showRaw('2');await tick();view.user.account={oId:'9'};finish(env(base));await obsolete;assert.equal(view.model.rawOpen.value,false);assert.equal(view.model.rawText.value,'');view.scope.stop()
console.log('PASS chat source 9 account switch discards in-flight raw response')
const releases=[];state.dispatch=()=>new Promise(r=>releases.push(r));view=setup();const first=view.model.quoteMessage('2');await tick();const second=view.model.quoteMessage('3');await tick();releases[1](env({...base,id:'3',content:'latest'}));await second;releases[0](env(base));await first;assert.equal(view.model.quote.value.messageId,'3');assert.equal(view.model.quote.value.content,'latest');view.scope.stop()
console.log('PASS chat source 10 newer quote target wins over slower original target')
view=setup();state.dispatch=async()=>{throw new ApiError('source503',503)};await view.model.showRaw('2');assert.equal(view.model.rawText.value,'');assert.match(view.model.rawError.value,/503/);state.dispatch=async()=>env({...base,content:'',contentHtml:''});await view.model.showRaw('2');assert.equal(view.model.rawOpen.value,true);assert.equal(view.model.rawText.value,'');assert.equal(view.model.rawError.value,'');view.scope.stop()
console.log('PASS chat source 11 errors separate from body, legitimate empty raw still opens dialog and retry clears prior error')
const ssrHook=(await import(hookURL(true))).useChatMessageSource;setActivePinia(createPinia());const scope=effectScope();let ssr;scope.run(()=>ssr=ssrHook());const prior=state.calls.length;await ssr.showRaw('2');await ssr.quoteMessage('2');assert.equal(state.calls.length,prior);scope.stop();const page=await fs.readFile('src/views/ChatroomView.vue','utf8'),legacy=await fs.readFile('src/api/fishpi.ts','utf8');assert.ok(!legacy.includes('fetchChatRaw'));assert.equal((page.match(/!entry\.message\.redPacket && accessToken/g)||[]).length,2);assert.ok(page.includes('readQuote(msg.oId)')&&!page.includes('content.trim(), html: msg.card'));assert.ok(!page.includes('rawOpen')&&!page.includes('showRaw(msg.oId)')&&page.includes('role="alert"'))
console.log('PASS chat source 12 SSR makes no source request, both layouts use Bearer actions/current detail and visible failures')
let storageReads=0;globalThis.localStorage={getItem(key){storageReads++;return key==='fp_chat_style'?'modern':JSON.stringify({theme:'classic-light',bubble:'default',frame:'default'})},setItem(){}};globalThis.document={documentElement:{dataset:{}}}
const packs=url("export const DEFAULT_THEME='classic-dark',DEFAULT_BUBBLE='default',DEFAULT_FRAME='default';export function findPack(){return null}"),appearanceCode=compile((await fs.readFile('src/stores/appearance.ts','utf8')).replaceAll('import.meta.env.SSR','false'))
const {useAppearanceStore}=await import(url(replace(appearanceCode,[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/packs',packs],['./auth',authURL]])));setActivePinia(createPinia());const appearance=useAppearanceStore();assert.equal(storageReads,0);assert.equal(appearance.state.theme,'classic-dark');appearance.restore();await tick();assert.equal(appearance.state.theme,'classic-light');assert.equal(document.documentElement.dataset.theme,'classic-light');appearance.$dispose()
const fishpiStub=url('export async function fetchChatHistory(){return[]}export async function fetchChatNodeBundle(){}export async function fetchChatOnlineUsers(){return{}}export async function fetchMutes(){return[]}export async function openRedPacket(){}export async function revokeChat(){}export async function sendChat(){}'),cardStub=url('export function parseChatCard(){}'),reactionStub=url('export function useV3ReactionsStore(){return{invalidate(){}}}')
const chatCode=compile((await fs.readFile('src/stores/chat.ts','utf8')).replaceAll('import.meta.env.SSR','false')).replace("from '@/utils/chatConnectionOwners'", `from '${url(compile(await fs.readFile('src/utils/chatConnectionOwners.ts','utf8')))}'`),chatModule=await import(url(replace(chatCode,[['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/api/fishpi',fishpiStub],['@/utils/chatCard',cardStub],['./auth',authURL],['./v3ChatOnline',url('export function useV3ChatOnlineStore(){return{users:[],total:null,connect:async()=>{},disconnect(){},refresh:async()=>{}}}')],['./v3ChatTimeline',url('export function useV3ChatTimelineStore(){return{messages:[],topic:"",connected:false,connecting:false,loading:false,loadingMore:false,hasMore:false,error:""}}')],['./v3Reactions',reactionStub],['./v3ChatPublication',url(`import{ref}from'${import.meta.resolve('vue')}';export function useV3ChatPublicationStore(){return{busy:false,currentMessage:ref(null),completed:ref(null)}}`)]])));setActivePinia(createPinia());const readsBefore=storageReads,chat=chatModule.useChatStore();assert.equal(chat.chatStyle,'classic');assert.equal(storageReads,readsBefore);chat.restoreStyle();assert.equal(chat.chatStyle,'modern');chat.$dispose();const shell=await fs.readFile('src/layouts/AppShell.vue','utf8');assert.ok(shell.includes('mounted.value = true\n  branding.restore()\n  appearance.restore()\n  chat.restoreStyle()'))
console.log('PASS chat source 13 actual appearance/chat stores share SSR defaults and defer saved layout/theme reads until mounted shell restoration')

const { JSDOM } = await import('jsdom')
const { extractLatestChatQuote, hasChatQuoteBody, chatMessageQuotePreview } = await import(url(compile(await fs.readFile('src/utils/chatQuote.ts','utf8'))))
const quoteDOM = new JSDOM()
const quoteTemplate = quoteDOM.window.document.createElement('template')
quoteTemplate.innerHTML = [
  '<p>我的回复</p>',
  '<h5>引用 @<a href="/member/fish">fish</a> <a href="/cr#chatroom2">↩</a></h5>',
  '<blockquote><p>第一行<br>第二行</p></blockquote>',
  '<h5>引用 <a href="https://example.com/cr#chatroom2">↩</a></h5>',
  '<blockquote><p>外部链接保留原样</p></blockquote>',
].join('')
assert.deepEqual(extractLatestChatQuote(quoteTemplate.content, 'https://yui.fishpi.cn'),
  { kind: 'message', href: '/cr#chatroom2', author: 'fish', excerpt: '第一行 第二行' })
assert.equal(quoteTemplate.content.querySelectorAll('blockquote').length, 1)
assert.match(quoteTemplate.innerHTML, /我的回复.*外部链接保留原样/)
const moon = '<blockquote><p><a href="/member/fish/breezemoons/7">清风明月 · ?????</a></p><p>快点放假吧</p></blockquote>'
for (const body of ['', '<p>111</p>', '<p><img src="/logo.png"></p>']) {
  // 浏览器会把服务端的段落包装拆成空段落和引用块。
  quoteTemplate.innerHTML = body + '<p>' + moon + '</p><div><span>&nbsp;<br></span></div>'
  const quote = extractLatestChatQuote(quoteTemplate.content, 'https://yui.fishpi.cn')
  assert.equal(quote.author, '?????')
  assert.equal(quote.excerpt, '快点放假吧')
  assert.equal(hasChatQuoteBody(quoteTemplate.content), Boolean(body))
}
// 旧版图片箭头、包装层、嵌套引用与新版来源都应识别，不误认外站链接。
quoteTemplate.innerHTML = `<div><p>我的回复</p>
<p>引用 @<a href="/member/outer">outer</a> <a href="https://fishpi.cn/cr#chatroom10"><img class="emoji" alt=":leftwards_arrow_with_hook:" src="/arrow.png"></a></p>
<blockquote><p>外层正文</p><h5>引用 @inner <a href="https://new.fishpi.cn/cr#chatroom11">↩</a></h5><blockquote><p>内层正文</p></blockquote><blockquote><p>手写引用</p></blockquote></blockquote>
<h5>引用 @evil <a href="https://fishpi.cn.evil.example/cr#chatroom12">↩</a></h5><blockquote><p>保留原文</p></blockquote>
<blockquote><p>普通手写内容</p></blockquote></div>`
assert.deepEqual(extractLatestChatQuote(quoteTemplate.content, 'https://yui.fishpi.cn'),
  { kind: 'message', href: '/cr#chatroom10', author: 'outer', excerpt: '外层正文 手写引用' })
assert.match(quoteTemplate.innerHTML, /我的回复/)
assert.match(quoteTemplate.innerHTML, /保留原文/)
assert.match(quoteTemplate.innerHTML, /普通手写内容/)
assert.equal(quoteTemplate.content.querySelectorAll('blockquote').length, 2)

// Rhythm 的 cleanChat 使用空 baseURI，Jsoup 会移除相对 href，但保留标题、作者及回跳箭头。
const legacySource = '1\n\n##### 引用 @Yui [↩](/cr#chatroom123 "跳转至原消息")  \n> 第一行\n> 第二行\n'
const lostLinkHTML = '<p>1</p><h5>引用 @<a href="https://fishpi.cn/member/Yui">Yui</a> <a title="跳转至原消息">↩</a></h5><blockquote><p>第一行<br>第二行</p></blockquote>'
quoteTemplate.innerHTML = lostLinkHTML
assert.deepEqual(extractLatestChatQuote(quoteTemplate.content, 'https://yui.fishpi.cn', legacySource),
  { kind: 'message', href: '/cr#chatroom123', author: 'Yui', excerpt: '第一行 第二行' })
assert.equal(quoteTemplate.innerHTML, '<p>1</p>')
quoteTemplate.innerHTML = lostLinkHTML.replace('>↩</a>', '><img class="emoji" alt=":leftwards_arrow_with_hook:" src="/arrow.png"></a>')
assert.equal(extractLatestChatQuote(quoteTemplate.content, 'https://yui.fishpi.cn', legacySource).href, '/cr#chatroom123')
assert.equal(quoteTemplate.innerHTML, '<p>1</p>')

for (const source of [
  '',
  legacySource.replace('@Yui ', '@other '),
  legacySource.replace('> 第一行', '普通正文'),
  '```md\n' + legacySource + '\n```',
  legacySource.split('\n').map(line => '    ' + line).join('\n'),
  legacySource + '\n##### 引用 @other [↩](/cr#chatroom456 "跳转至原消息")\n> 多出的引用',
  ...['https://fishpi.cn.evil.example/cr#chatroom123', 'https://evil.example/cr#chatroom123', 'javascript:alert',
    'https://fishpi.cn/cr?x=1#chatroom123', 'https://user:password@fishpi.cn/cr#chatroom123', '/cr#chatroomx',
    '/chat#chatroom123'].map(href => legacySource.replace('/cr#chatroom123', href)),
]) {
  quoteTemplate.innerHTML = lostLinkHTML
  assert.equal(extractLatestChatQuote(quoteTemplate.content, 'https://yui.fishpi.cn', source), null)
  assert.equal(quoteTemplate.innerHTML, lostLinkHTML)
}

// 代码块中的伪引用不参与对应；真实引用仍可恢复，且不采用原文里任意 HTML。
quoteTemplate.innerHTML = lostLinkHTML
const codeThenQuote = '```md\n##### 引用 @fake [↩](/cr#chatroom999 "跳转至原消息")\n> 代码\n```\n' + legacySource
assert.equal(extractLatestChatQuote(quoteTemplate.content, 'https://yui.fishpi.cn', codeThenQuote).href, '/cr#chatroom123')
quoteTemplate.innerHTML = lostLinkHTML
assert.equal(extractLatestChatQuote(quoteTemplate.content, 'https://yui.fishpi.cn', '<h5>引用 @Yui <a href="/cr#chatroom123">↩</a></h5><blockquote>原始 HTML</blockquote>'), null)
assert.equal(quoteTemplate.innerHTML, lostLinkHTML)
for (const html of [lostLinkHTML.replace(' title="跳转至原消息"', ''), lostLinkHTML.replace('>↩</a>', '>其他链接</a>')]) {
  quoteTemplate.innerHTML = html
  assert.equal(extractLatestChatQuote(quoteTemplate.content, 'https://yui.fishpi.cn', legacySource), null)
  assert.equal(quoteTemplate.innerHTML, html)
}

// 同一作者的嵌套引用按原始顺序和层级匹配，内层不会污染外层摘要。
const nestedSource = '##### 引用 @Yui [↩](/cr#chatroom123 "跳转至原消息")\n> 外层\n>\n> ##### 引用 @Yui [↩](/cr#chatroom456 "跳转至原消息")\n> > 内层'
const nestedHTML = '<h5>引用 @Yui <a title="跳转至原消息">↩</a></h5><blockquote><p>外层</p><h5>引用 @Yui <a title="跳转至原消息">↩</a></h5><blockquote><p>内层</p></blockquote></blockquote>'
quoteTemplate.innerHTML = nestedHTML
assert.deepEqual(extractLatestChatQuote(quoteTemplate.content, 'https://yui.fishpi.cn', nestedSource),
  { kind: 'message', href: '/cr#chatroom123', author: 'Yui', excerpt: '外层' })
assert.equal(hasChatQuoteBody(quoteTemplate.content), false)
quoteTemplate.innerHTML = '<h5>引用 @Yui <a title="跳转至原消息">↩</a></h5><blockquote><blockquote><p>手写引用</p></blockquote></blockquote>'
assert.deepEqual(extractLatestChatQuote(quoteTemplate.content, 'https://yui.fishpi.cn', '##### 引用 @Yui [↩](/cr#chatroom123 "跳转至原消息")\n> > 手写引用'),
  { kind: 'message', href: '/cr#chatroom123', author: 'Yui', excerpt: '手写引用' })
assert.equal(hasChatQuoteBody(quoteTemplate.content), false)
quoteTemplate.innerHTML = nestedHTML
assert.equal(extractLatestChatQuote(quoteTemplate.content, 'https://yui.fishpi.cn', nestedSource.replace('> #####', '#####').replace('> > 内层', '> 内层')), null)
assert.equal(quoteTemplate.innerHTML, nestedHTML)

// 已有绝对链接与丢失链接可混用；已知链接与原文不符时只保留其自身可验证的引用。
const mixedHTML = nestedHTML.replace('<a title="跳转至原消息">↩</a>', '<a href="https://fishpi.cn/cr#chatroom123" title="跳转至原消息">↩</a>')
quoteTemplate.innerHTML = mixedHTML
assert.equal(extractLatestChatQuote(quoteTemplate.content, 'https://yui.fishpi.cn', nestedSource).excerpt, '外层')
quoteTemplate.innerHTML = mixedHTML
assert.equal(extractLatestChatQuote(quoteTemplate.content, 'https://yui.fishpi.cn', nestedSource.replace('#chatroom123', '#chatroom999')).href, '/cr#chatroom123')

// 生成器转义的昵称文本可精确匹配；实体或原始 HTML 改变显示后不靠近似作者名猜目标。
quoteTemplate.innerHTML = lostLinkHTML.replaceAll('Yui', 'a_b')
assert.equal(extractLatestChatQuote(quoteTemplate.content, 'https://yui.fishpi.cn', legacySource.replace('@Yui ', '@a\\_b ')).author, 'a_b')
for (const name of ['Y&#117;i', '<b>Yui</b>', 'Yui &amp; other']) {
  quoteTemplate.innerHTML = lostLinkHTML
  assert.equal(extractLatestChatQuote(quoteTemplate.content, 'https://yui.fishpi.cn', legacySource.replace('@Yui ', `@${name} `)), null)
  assert.equal(quoteTemplate.innerHTML, lostLinkHTML)
}

globalThis.document = quoteDOM.window.document
globalThis.window = { location: { origin: 'https://yui.fishpi.cn' } }
assert.equal(chatMessageQuotePreview({ messageId: '789', userName: 'Yui', html: lostLinkHTML, label: legacySource }).excerpt, '1')
quoteDOM.window.close()
console.log('PASS chat source 14 compact quote requires a trusted original-message link and preserves surrounding content')
console.log('PASS chat source 15 generated absolute links survive chat cleaning; missing legacy links recover only from matching trusted Markdown markers')
