import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { JSDOM } from 'jsdom'
import { parse, compileScript } from '@vue/compiler-sfc'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/cr' })
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'SVGElement']) globalThis[key] = dom.window[key]
const { createApp, reactive, nextTick, h } = await import('vue')
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const http = moduleUrl('export class ApiError extends Error{}; export const request=()=>{throw Error("unexpected request")}')
const appearances = moduleUrl(compile(await fs.readFile('src/utils/chatAppearance.ts', 'utf8')))
const reactions = moduleUrl(compile(await fs.readFile('src/api/v3-reactions.ts', 'utf8')).replace("from './http'", `from '${http}'`))
const api = await import(moduleUrl(compile(await fs.readFile('src/api/v3-chat-messages.ts', 'utf8'))
  .replace("from './http'", `from '${http}'`)
  .replace("from '@/utils/chatAppearance'", `from '${appearances}'`)
  .replace("from './v3-reactions'", `from '${reactions}'`)))
const message = { id: '10', createdAt: 10, type: 'text', content: '原正文', contentHtml: '<p>原正文</p>',
  author: { id: '2', userName: 'fish', userNickname: '鱼', userAvatarURL: '' }, client: 'Web/PC网页端', card: {} }
const tail = { text: '今天也要快乐🐟', secret: 'not public' }
assert.deepEqual(api.decodeChatMessage({ ...message, tail }).tail, { text: tail.text })
assert.equal(api.decodeChatMessage(message).tail, undefined)
for (const invalid of [null, [], 'plain', {}, { text: '' }, { text: ' ' }, { text: 'x'.repeat(513) }, { text: '\nunsafe' }, { text: '\u202eunsafe' }, { text: '\ud800' }]) {
  const decoded = api.decodeChatMessage({ ...message, tail: invalid })
  assert.equal(decoded.tail, undefined)
  assert.equal(decoded.content, message.content, '坏尾巴不能丢弃消息')
}
assert.equal(api.decodeChatMessage({ ...message, tail: { text: '👨‍👩‍👧‍👦' } }).tail.text, '👨‍👩‍👧‍👦')
assert.equal(api.decodeChatMessage({ ...message, tail: { text: '字'.repeat(25) } }).tail.text.length, 25, '历史快照不使用本机 Unicode 分段重新拒绝服务端已确认内容')
assert.equal(api.decodeChatMessage({ ...message, type: 'unavailable', tail }).tail, undefined)
assert.equal(api.decodeChatMessage({ ...message, type: 'music', card: { title: '歌', source: '1', coverURL: '', from: 'netease' }, tail }).tail, undefined)
assert.equal(api.chatSourceText(api.decodeChatMessage({ ...message, tail })), message.content)
console.log('PASS 小尾巴白名单、坏字段降级、正文权限及原文不混入尾巴')

const preferences = reactive({ simpleMode: false })
globalThis.__chatTailPreferences = preferences
const stateModule = moduleUrl('export const useChatPreferencesStore=()=>globalThis.__chatTailPreferences')
const componentStub = moduleUrl(`import {h} from '${import.meta.resolve('vue')}';export default {setup(_,{slots}){return()=>h('span',slots.default?.())}}`)
const quoteModule = moduleUrl('export const extractChatQuotes=()=>[];export const hasChatQuoteBody=()=>true')
const imageModule = moduleUrl(compile(await fs.readFile('src/utils/chatMessage.ts', 'utf8')))
const file = 'src/components/ChatBubble.vue'
const source = await fs.readFile(file, 'utf8')
const { descriptor } = parse(source, { filename: file })
let code = compile(compileScript(descriptor, { id: 'chat-tail-test', inlineTemplate: true }).content)
const replacements = {
  vue: import.meta.resolve('vue'),
  'vue-router': moduleUrl(`import {h} from '${import.meta.resolve('vue')}'; export const RouterLink={setup(_,{slots}){return()=>h('a',slots.default?.())}}`),
  '@/stores/chatPreferences': stateModule,
  '@/stores/functionPreferences': moduleUrl('export const useFunctionPreferencesStore=()=>({blurChatImages:false})'),
  '@/utils/time': moduleUrl('export const formatDisplayTime=()=>""'),
  '@/chat/mention': moduleUrl('export const CHAT_MENTION=Symbol();export const chatMentionText=x=>x'),
  '@/utils/avatar': moduleUrl('export const DEFAULT_AVATAR="";export const avatarThumbnail=x=>x;export const rhyPicThumbnail=x=>x'),
  '@/utils/chatAppearance': appearances,
  '@/utils/chatMessage': imageModule,
  '@/utils/chatQuote': quoteModule,
}
code = code.replace(/from (["'])([^"']+)\1/g, (match, _quote, name) => `from '${replacements[name] || (name.endsWith('.vue') ? componentStub : name)}'`)
const ChatBubble = (await import(moduleUrl(code))).default
const props = reactive({ userName: 'fish', html: '<p>原正文</p>', chatroom: true, tail: { text: '<img src=x onerror=alert(1)> @fish' } })
const mount = document.createElement('div'); document.body.append(mount)
// 使用真实组件模板，验证纯文本渲染和已挂载后的精简开关。
const app = createApp({ render: () => h(ChatBubble, props) })
app.mount(mount); await nextTick()
const tailNode = () => mount.querySelector('.fp-chat-tail[data-chat-tail]')
assert.equal(tailNode().querySelector('.tail-content').textContent, props.tail.text)
assert.equal(tailNode().querySelector('.tail-label').textContent, '小尾巴')
assert.equal(tailNode().querySelector('img'), null)
assert.equal(tailNode().querySelector('a'), null)
assert.equal(mount.querySelector('.body').textContent, '原正文')
preferences.simpleMode = true; await nextTick(); assert.equal(tailNode(), null)
preferences.simpleMode = false; await nextTick(); assert.equal(tailNode().querySelector('.tail-content').textContent, props.tail.text)
props.standalone = true; await nextTick(); assert.equal(tailNode(), null)
props.standalone = false; props.chatroom = false; await nextTick(); assert.equal(tailNode(), null)
app.unmount()
console.log('PASS 真实 ChatBubble 模板纯文本、标识、精简即时隐藏恢复和特殊卡片/非聊天室排除')

for (const [file, count] of [
  ['src/views/ChatroomView.vue', 2],
  ['src/components/chat/WhisperConversations.vue', 1],
  ['src/components/chat/HiddenChatConversations.vue', 1],
  ['src/components/chat/ChatContextPanel.vue', 1],
]) {
  const text = await fs.readFile(file, 'utf8')
  assert.equal((text.match(/:tail="(?:entry\.message|line|message)\.tail"/g) || []).length, count, file)
}
assert.match(await fs.readFile('src/stores/chat.ts', 'utf8'), /tail:message\.tail/)
console.log('PASS 经典/简约、悬浮、隐藏会话及上下文的小尾巴传递接线')
