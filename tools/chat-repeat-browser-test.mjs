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
export const chatPetStatusLabels={idle:'空闲'},formatDisplayTime=()=> '12:30';
export const chatMessageDetail=async()=>{window.reads=(window.reads||0)+1;await new Promise(r=>setTimeout(r,80));return {type:'text',content:'一起摸鱼'}};`)
const modules = {vue, '@/utils/chatRepeatGroups':data(transpile(fs.readFileSync('src/utils/chatRepeatGroups.ts','utf8'))), '@/utils/avatar':data(transpile(fs.readFileSync('src/utils/avatar.ts','utf8')))}
for (const name of ['@/stores/chatPreferences','@/stores/functionPreferences','@/stores/auth','@/stores/v3ChatPublication','@/api/http','@/api/v3-chat-messages','@/utils/time']) modules[name]=mocks
for (const name of ['chatAppearance','chatMessage','chatQuote']) modules['@/utils/'+name]=data(transpile(fs.readFileSync('src/utils/'+name+'.ts','utf8')))
modules['@/chat/mention']=data(transpile(fs.readFileSync('src/chat/mention.ts','utf8')))
// 路由导航和外围服务隔离；实际气泡仍负责昵称、@ 行为、身份及方向。
modules['vue-router']=data(`import {h} from '${vue}';export const RouterLink={props:['to'],setup(p,{slots}){return()=>h('a',{href:typeof p.to==='string'?p.to:JSON.stringify(p.to)},slots.default?.())}}`)
const noop=data('export default {setup(){return()=>null}}')
for(const name of ['@/components/chat/CollectChatEmoji.vue','@/components/ImageLightbox.vue','@/components/medal/MedalList.vue','@/components/user/VipNickname.vue']) modules[name]=noop
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
modules['@/components/chat/ChatQuoteCard.vue']=compile('src/components/chat/ChatQuoteCard.vue','data-v-quote')
const bubble=compile('src/components/ChatBubble.vue','data-v-bubble')
const avatar='data:image/png;base64,'+fs.readFileSync('public/images/user-thumbnail.png').toString('base64')
const packs=['candy','fishpond-blue','star-route'].map(id=>fs.readFileSync(`src/packs/bubbles/${id}/style.css`,'utf8')).join('\n')
const html=`<!DOCTYPE html><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;font:14px system-ui;background:#f4f6f8;--fp-card:#fff;--fp-border:#dfe4e9;--fp-text:#252a31;--fp-muted:#737c89;--fp-primary:#62ae37;--fp-hover:#f4f6f8}
.fixture-panel{padding:24px;background:white;max-width:760px;margin:16px auto}.vditor-reset p{margin:0}a{color:inherit}body{--fp-avatar-radius:8px;--fp-bg:#f4f6f8;--fp-self:#edf4e7}${css}${packs}</style><div id="app"></div><script type="module">
import {createApp,h,ref,provide} from '${vue}';import List from '${list}';import Bubble from '${bubble}';import {CHAT_MENTION} from '${modules['@/chat/mention']}';
const make=(id,name,content='一起摸鱼')=>({key:id,message:{oId:id,userName:name,userNickname:name,userAvatarURL:'${avatar}',html:'<p>'+content+'</p>',content,appearance:{version:1,frameId:'none',bubbleId:name==='我'?'candy':'fishpond-blue'}}});
const entries=ref([make('1','小羊'),{key:'join',message:null,notice:{kind:'join'}},make('2','冰岚'),{key:'claim',message:null,notice:{kind:'claim'}},make('3','我')]);
const reverse=ref(false),ownName=ref('我');window.entries=entries;window.make=make;window.reverse=reverse;window.ownName=ownName;
window.mentions=[];
createApp({setup(){provide(CHAT_MENTION,{enabled:()=>true,insert:name=>window.mentions.push(name)});return()=>h('div',{class:'fixture-panel'},[h(List,{entries:entries.value,ownName:ownName.value,reverse:reverse.value},{default:({entry,alignSelf})=>entry.notice?h('p',{'data-notice':entry.key},entry.notice.kind):h(Bubble,{chatroom:true,self:entry.message.userName==='我',alignSelf,userName:entry.message.userName,userId:entry.message.userName==='我'?'me':'other',avatar:'${avatar}',html:entry.message.html,source:entry.message.content,appearance:entry.message.appearance,'data-message':entry.key,'data-author':entry.message.userName})})])}}).mount('#app');
</script>`
const browser=await chromium.launch({channel:'chrome',headless:true})
try {
 const page=await browser.newPage({viewport:{width:1000,height:900}}), errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('http://repeat.test/**',r=>r.fulfill({contentType:'text/html',body:html}))
 await page.route('https://file.fishpi.cn/**',r=>r.fulfill({contentType:'image/png',body:fs.readFileSync('public/images/user-thumbnail.png')}))
 await page.goto('http://repeat.test/');await page.waitForSelector('.repeat-preview')
 // 分组、气泡、@ 行为、插槽方向和样式均使用实际生产组件。
 async function direction(self) {
  assert.equal(await page.locator('.repeat-group').filter({has:page.locator('[data-message]')}).evaluate(el=>el.classList.contains('repeat-group--self')),self)
  for (const message of await page.locator('[data-message]').all()) {
   assert.equal(await message.evaluate(el=>el.classList.contains('is-self')),self,'完整层和展开项遵循首条方向')
   const own=(await message.getAttribute('data-author'))==='我'
   assert.equal(await message.locator('button.name--mention').count(),own?0:1,'方向强制不能改变本人判断及 @ 行为')
   assert.equal(await message.locator('.name').evaluate(el=>el.tagName),own?'A':'BUTTON')
  }
 }
 async function compactLayers() {
  assert.equal(await page.locator('.repeat-author').count(),0,'后层不显示昵称')
  assert.equal(await page.locator('.repeat-front [data-message]').count(),1,'只保留一个完整前层')
  for(const layer of await page.locator('.repeat-layer').all()) {
   const geometry=await layer.evaluate(el=>{
    const box=el.getBoundingClientRect(),avatar=el.querySelector('.repeat-avatar'),sheet=el.querySelector('.repeat-sheet');
    const a=avatar.getBoundingClientRect(),s=sheet.getBoundingClientRect(),hit=document.elementFromPoint(a.left+a.width/2,a.top+a.height/2);
    return {height:box.height,avatarWidth:a.width,avatarHeight:a.height,topDelta:Math.abs(a.top-s.top),avatarVisible:hit===avatar,clip:getComputedStyle(sheet).clipPath};
   })
   assert.ok(Math.abs(geometry.avatarWidth-20)<0.1);assert.ok(Math.abs(geometry.avatarHeight-20)<0.1)
   assert.ok(geometry.height<=28.1,'每层不能再占整条消息高度')
   assert.ok(geometry.topDelta<=4,'头像与气泡切片同一行')
   assert.ok(geometry.avatarVisible,'后层头像没有被下一层遮挡')
   assert.notEqual(geometry.clip,'none','后层气泡只露出切片')
  }
 }
 assert.equal(await page.locator('.repeat-deck').count(),1)
 assert.equal(await page.locator('[data-notice]').count(),2)
 assert.equal(await page.locator('[data-message]').getAttribute('data-message'),'3','最新一条保持完整前层')
 await direction(false)
 for(const width of [1000,560,390,320]) {
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(100)
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`横向溢出 ${width}`)
  await compactLayers()
  for(const preview of await page.locator('.repeat-preview').all()) assert.equal(await preview.innerText(),'一起摸鱼')
 }
 await page.screenshot({path:'/tmp/chat-repeat-compact-320.png'})
 await page.setViewportSize({width:1000,height:1000});await page.screenshot({path:'/tmp/chat-repeat-compact-1000.png'})
 await page.locator('.chat-repeat--compact button').evaluate(el=>{el.click();el.click()})
 await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.sent),1);assert.equal(await page.evaluate(()=>window.reads),1)
 await page.locator('.repeat-controls > button').click();assert.equal(await page.locator('[data-message]').count(),3)
 await direction(false)
 await page.locator('.repeat-controls > button').click()
 await page.evaluate(()=>{reverse.value=true});await page.waitForTimeout(60)
 assert.equal(await page.locator('.repeat-group').first().getAttribute('data-repeat-messages'),'1 2 3')
 await direction(false)
 await page.evaluate(()=>entries.value.push(make('4','我')));await page.waitForTimeout(60)
 await direction(false)
 assert.equal(await page.locator('.repeat-front [data-message]').getAttribute('data-message'),'4')
 // 首条属于本人时，后来他人复读及展开均保持右侧；真实作者信息不改。
 await page.evaluate(()=>{reverse.value=false;entries.value=[make('10','我'),make('11','小羊')]});await page.waitForTimeout(60)
 await direction(true);await compactLayers()
 await page.locator('.repeat-front button.name--mention').click();assert.deepEqual(await page.evaluate(()=>window.mentions),['小羊'])
 await page.evaluate(()=>entries.value.push(make('12','冰岚')));await page.waitForTimeout(60)
 await direction(true)
 await page.locator('.repeat-controls > button').click();await direction(true)
 assert.deepEqual((await page.locator('[data-message] .chat-author-name').allTextContents()).map(s=>s.trim()),['我','小羊','冰岚'])
 await page.locator('.repeat-controls > button').click()
 for(const width of [1000,390,320]) {
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(60)
  await compactLayers()
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`本人起始横向溢出 ${width}`)
 }
 await page.screenshot({path:'/tmp/chat-repeat-compact-self-320.png'})
 // 长队列最多露出六层，完整消息、操作目标仍为最新一条。
 await page.evaluate(()=>{entries.value=Array.from({length:12},(_,i)=>make(String(20+i),i%2?'我':'小羊'))});await page.waitForTimeout(60)
 await direction(false);await compactLayers()
 assert.equal(await page.locator('.repeat-layer').count(),6)
 assert.equal(await page.locator('.repeat-front [data-message]').getAttribute('data-message'),'31')
 assert.ok((await page.locator('.repeat-controls > button').innerText()).includes('12'))
 await page.locator('.repeat-controls > button').click()
 assert.equal(await page.locator('[data-message]').count(),12);await direction(false)
 await page.evaluate(()=>reverse.value=true);await page.waitForTimeout(60)
 assert.equal(await page.locator('[data-message]').first().getAttribute('data-message'),'31')
 await direction(false)
 await page.locator('.repeat-controls > button').click()
 await page.evaluate(()=>ownName.value=undefined);await page.waitForTimeout(40)
 await direction(false)
 await page.evaluate(()=>{entries.value=[make('4','小羊'),make('5','冰岚')];for(const e of entries.value){e.message.content='图片一起摸鱼';e.message.html='<p><img src="https://file.fishpi.cn/fish.png">一起摸鱼</p>'}})
 await page.waitForSelector('.repeat-picture');assert.ok((await page.locator('.repeat-picture').getAttribute('src')).includes('80'))
 assert.equal(await page.locator('.repeat-preview').innerText(),'一起摸鱼')
 await page.evaluate(()=>prefs.blurChatImages=true);await page.waitForTimeout(40)
 assert.equal(await page.locator('.repeat-picture').evaluate(el=>getComputedStyle(el).filter),'blur(6px)')
 await page.evaluate(()=>prefs.simpleMode=true);await page.waitForTimeout(40)
 assert.equal(await page.locator('.repeat-layer-shell').getAttribute('data-bubble'),'none')
 await page.evaluate(()=>{entries.value=[make('40','我'),make('41','小羊')];for(const e of entries.value){e.message.content='图片';e.message.html='<p><img src="https://file.fishpi.cn/fish.png"></p>'}ownName.value='我'})
 await page.waitForTimeout(60);await direction(true);await compactLayers()
 assert.equal(await page.locator('.repeat-front .fp-msg.is-image.is-standalone').count(),1,'图片只保留一个完整原图预览')
 assert.equal(await page.locator('.repeat-front .body img').count(),1)
 await page.screenshot({path:'/tmp/chat-repeat-compact-image-320.png'})
 // 单条没有强制方向，继续使用原 self；不能让新插槽字段把本人单条改到左侧。
 await page.evaluate(()=>{prefs.simpleMode=false;entries.value=[make('50','我')]});await page.waitForTimeout(40)
 assert.equal(await page.locator('[data-message].is-self').count(),1)
 assert.equal(await page.locator('button.name--mention').count(),0)
 assert.equal(await page.locator('.repeat-deck').count(),0)
 await page.evaluate(()=>entries.value=[make('51','小羊')]);await page.waitForTimeout(40)
 assert.equal(await page.locator('[data-message].is-self').count(),0)
 assert.equal(await page.locator('button.name--mention').count(),1)
 await page.evaluate(()=>entries.value=[]);await page.waitForTimeout(40);assert.equal(await page.locator('.repeat-group').count(),0)
 assert.deepEqual(errors,[])
 console.log('PASS 实际复读组件：首条固定方向、真实身份保留、后层仅头像和切片、最新完整前层、六层上限、倒序/展开/追加、320px 至桌面、通知跨越、图片、+1 防连击、精简/模糊和清屏')
} finally {await browser.close()}
