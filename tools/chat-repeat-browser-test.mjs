import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const data = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
const transpile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const vue = data(fs.readFileSync('node_modules/vue/dist/vue.esm-browser.prod.js', 'utf8'))
// 接口与发送均使用本地夹具，验证点击次数，不触碰真实聊天室。
const mocks = data(`import {reactive} from '${vue}';
export const prefs=reactive({simpleMode:false,blurChatImages:false});window.prefs=prefs;
export const useChatPreferencesStore=()=>prefs,useFunctionPreferencesStore=()=>prefs;
export const useAuthStore=()=>({accessToken:'fixture',account:{oId:'me'}}),getAuthContextVersion=()=>1;
const publication=reactive({busy:false,pending:null,async send(content){publication.busy=true;window.sent=(window.sent||0)+1;await new Promise(r=>setTimeout(r,120));publication.busy=false}});
export const useV3ChatPublicationStore=()=>publication;
export const chatMessageDetail=async()=>{window.reads=(window.reads||0)+1;await new Promise(r=>setTimeout(r,80));return {type:'text',content:'一起摸鱼'}};`)
const modules = {vue, '@/utils/chatRepeatGroups':data(transpile(fs.readFileSync('src/utils/chatRepeatGroups.ts','utf8'))), '@/utils/avatar':data(transpile(fs.readFileSync('src/utils/avatar.ts','utf8')))}
for (const name of ['@/stores/chatPreferences','@/stores/functionPreferences','@/stores/auth','@/stores/v3ChatPublication','@/api/http','@/api/v3-chat-messages']) modules[name]=mocks
let css=''
function compile(file,id) {
  const {descriptor}=parse(fs.readFileSync(file,'utf8'))
  let script=transpile(compileScript(descriptor,{id,inlineTemplate:true}).content)
  script=script.replace(/from (['"])([^'"]+)\1/g,(_,q,path)=>`from '${modules[path]||path}'`).replace('export default','const component =')
  css+=descriptor.styles.map(style=>compileStyle({source:style.content,filename:file,id,scoped:true}).code).join('\n')
  return data(script+`;component.__scopeId='${id}';export default component;`)
}
modules['./ChatRepeatAction.vue']=compile('src/components/chat/ChatRepeatAction.vue','data-v-action')
const list=compile('src/components/chat/ChatRepeatList.vue','data-v-list')
const avatar='data:image/png;base64,'+fs.readFileSync('public/images/user-thumbnail.png').toString('base64')
const packs=['candy','fishpond-blue','star-route'].map(id=>fs.readFileSync(`src/packs/bubbles/${id}/style.css`,'utf8')).join('\n')
const html=`<!DOCTYPE html><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;font:14px system-ui;background:#f4f6f8;--fp-card:#fff;--fp-border:#dfe4e9;--fp-text:#252a31;--fp-muted:#737c89;--fp-primary:#62ae37;--fp-hover:#f4f6f8}
.panel{padding:24px;background:white;max-width:760px;margin:16px auto}.fp-msg{display:flex;gap:12px;margin-bottom:12px}.fp-msg.is-self{flex-direction:row-reverse}.message-stack{max-width:85%;display:flex;align-items:flex-start;flex-direction:column;gap:5px}.is-self .message-stack{align-items:flex-end}.head{font-size:12px;color:#77808d}.fp-avatar{width:36px;height:36px;border-radius:8px;flex:none}.fp-bubble{background:#f3f4f7;border:1px solid #dfe3e8;border-radius:3px 14px 14px;padding:10px 14px}.body-image{max-width:150px}.meta{font-size:11px;color:#9299a4}${packs}${css}</style><div id="app"></div><script type="module">
import {createApp,h,ref} from '${vue}';import List from '${list}';
const make=(id,name,content='一起摸鱼')=>({key:id,message:{oId:id,userName:name,userNickname:name,userAvatarURL:'${avatar}',html:'<p>'+content+'</p>',content,appearance:{bubbleId:name==='我'?'candy':'fishpond-blue'}}});
const entries=ref([make('1','小羊'),{key:'join',message:null,notice:{kind:'join'}},make('2','冰岚'),{key:'claim',message:null,notice:{kind:'claim'}},make('3','我')]);
const reverse=ref(false);window.entries=entries;window.make=make;window.reverse=reverse;
createApp({setup:()=>()=>h('div',{class:'panel'},[h(List,{entries:entries.value,ownName:'我',reverse:reverse.value},{default:({entry})=>entry.notice?h('p',{'data-notice':entry.key},entry.notice.kind):h('article',{class:['fp-msg',entry.message.userName==='我'?'is-self':''],'data-message':entry.key},[h('img',{class:'fp-avatar',src:'${avatar}'}),h('div',{class:'message-stack'},[h('div',{class:'head'},entry.message.userName),h('div',{class:'fp-bubble',innerHTML:entry.message.html}),h('div',{class:'meta'},'12:30 · 引用')])])})])}).mount('#app');
</script>`
const browser=await chromium.launch({channel:'chrome',headless:true})
try {
 const page=await browser.newPage({viewport:{width:1000,height:900}}), errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('http://repeat.test/**',r=>r.fulfill({contentType:'text/html',body:html}))
 await page.route('https://file.fishpi.cn/**',r=>r.fulfill({contentType:'image/png',body:fs.readFileSync('public/images/user-thumbnail.png')}))
 await page.goto('http://repeat.test/');await page.waitForSelector('.repeat-preview')
 assert.equal(await page.locator('.repeat-deck').count(),1)
 assert.equal(await page.locator('[data-notice]').count(),2)
 assert.equal(await page.locator('[data-message]').getAttribute('data-message'),'3')
 for(const width of [1000,560,390,320]) {
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(100)
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`横向溢出 ${width}`)
  for(const preview of await page.locator('.repeat-preview').all()) {
   assert.equal(await preview.innerText(),'一起摸鱼')
   assert.ok(await preview.evaluate(el=>{const r=el.getBoundingClientRect(), hit=document.elementFromPoint(r.left+4,r.top+12);return hit===el||el.contains(hit)||hit===el.closest('.repeat-layer')}),'正文预览不可被下一层遮住')
  }
 }
 await page.screenshot({path:'/tmp/chat-repeat-content-320.png'})
 await page.setViewportSize({width:1000,height:1000});await page.screenshot({path:'/tmp/chat-repeat-content-1000.png'})
 await page.locator('.chat-repeat--compact button').evaluate(el=>{el.click();el.click()})
 await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.sent),1);assert.equal(await page.evaluate(()=>window.reads),1)
 await page.locator('.repeat-controls > button').click();assert.equal(await page.locator('[data-message]').count(),3)
 await page.locator('.repeat-controls > button').click()
 await page.evaluate(()=>{reverse.value=true});await page.waitForTimeout(60)
 assert.equal(await page.locator('.repeat-group').first().getAttribute('data-repeat-messages'),'1 2 3')
 await page.evaluate(()=>{entries.value=[make('4','小羊'),make('5','冰岚')];for(const e of entries.value){e.message.content='图片一起摸鱼';e.message.html='<p><img src="https://file.fishpi.cn/fish.png">一起摸鱼</p>'}})
 await page.waitForSelector('.repeat-picture');assert.ok((await page.locator('.repeat-picture').getAttribute('src')).includes('80'))
 assert.equal(await page.locator('.repeat-preview').innerText(),'一起摸鱼')
 await page.evaluate(()=>prefs.blurChatImages=true);await page.waitForTimeout(40)
 assert.equal(await page.locator('.repeat-picture').evaluate(el=>getComputedStyle(el).filter),'blur(6px)')
 await page.evaluate(()=>prefs.simpleMode=true);await page.waitForTimeout(40)
 assert.equal(await page.locator('.repeat-layer-shell').getAttribute('data-bubble'),'none')
 await page.evaluate(()=>entries.value=[]);await page.waitForTimeout(40);assert.equal(await page.locator('.repeat-group').count(),0)
 assert.deepEqual(errors,[])
 console.log('PASS 实际复读组件：正文/图片预览、通知跨越、自己发言、窄屏、展开、+1 防连击、精简与模糊偏好、清屏')
} finally {await browser.close()}
