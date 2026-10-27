import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createRenderer, createSSRApp, h, nextTick, ref } from 'vue'
import { createPinia, defineStore } from 'pinia'
import { renderToString } from '@vue/server-renderer'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
globalThis.__donation={context:1,requests:[],responses:[]};const state=__donation
const http=url(`export class ApiError extends Error{constructor(message,status=0){super(message);this.status=status}}export function getAuthContextVersion(){return globalThis.__donation.context}export async function request(path,init){globalThis.__donation.requests.push({path,init});const value=globalThis.__donation.responses.shift();if(value instanceof Error)throw value;return value}`)
const sourceAPI=await fs.readFile('src/api/v3-donation.ts','utf8')
const api=await import(url(compile(sourceAPI.replaceAll('import.meta.env.DEV','true')).replace("from './http'",`from '${http}'`)))
for(const input of ['https://fishpi.cn/charge/point','https://example.org/base/charge/point','http://localhost:8080/charge/point','http://[::1]:8080/charge/point'])assert.equal(api.donationPageURL(input),input)
for(const input of ['',null,'javascript:alert(1)','//fishpi.cn/charge/point','http://example.org/charge/point','https://u:p@fishpi.cn/charge/point','https://fishpi.cn/charge/point?token=x','https://fishpi.cn/charge/point#x','https://fishpi.cn/x/../charge/point','https://fishpi.cn/charge/%70oint','https://fishpi.cn//charge/point','https://fishpi.cn/charge/point\n','https://fishpi.cn/pay/wechat'])assert.throws(()=>api.donationPageURL(input))
const prod=await import(url(compile(sourceAPI.replaceAll('import.meta.env.DEV','false')).replace("from './http'",`from '${http}'`)))
assert.throws(()=>prod.donationPageURL('http://localhost:8080/charge/point'))
state.responses.push({code:0,data:{url:'https://fishpi.cn/charge/point',apiKey:'ignored'}});assert.equal(await api.fetchV3DonationPage(),'https://fishpi.cn/charge/point');assert.deepEqual(state.requests,[{path:'/api/v3/payments/donation-page',init:{cache:'no-store'}}])
for(const response of [null,{code:1},{code:0,data:{}},{code:0,data:{url:'javascript:x'}}]){state.responses.push(response);await assert.rejects(api.fetchV3DonationPage())}
console.log('PASS donation 1 configured HTTPS page and dev loopback only; reject unsafe URLs, bad responses and use read-only v3 request')
const auth=defineStore('donation-auth',()=>({accessToken:ref('A'),account:ref({oId:'1'})}));globalThis.__donationAuth=auth;globalThis.__donationAPI={...api}
const apiURL=url(`export const fetchV3DonationPage=(...args)=>globalThis.__donationAPI.fetchV3DonationPage(...args)`),authURL=url('export const useAuthStore=globalThis.__donationAuth'),seoURL=url('export function usePageSeo(){}'),routerURL=url(`import{h}from'${import.meta.resolve('vue')}';export function useRoute(){return{fullPath:'/charge/point'}};export const RouterLink={props:['to'],setup:(p,{slots})=>()=>h('a',{href:typeof p.to==='string'?p.to:p.to.path},slots.default?.())}`)
const source=await fs.readFile('src/views/ChargePointView.vue','utf8'),descriptor=parse(source).descriptor
let code=compile(compileScript(descriptor,{id:'donation-test',inlineTemplate:true}).content)
for(const [from,to]of [['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['vue-router',routerURL],['@/api/http',http],['@/api/v3-donation',apiURL],['@/stores/auth',authURL],['@/composables/usePageSeo',seoURL]])code=code.replace(new RegExp(`from ['"]${from.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}['"]`,'g'),`from '${to}'`)
const component=(await import(url(code))).default
const insert=(node,parent,anchor)=>{if(node.parent){const i=node.parent.children.indexOf(node);if(i>=0)node.parent.children.splice(i,1)}const i=anchor?parent.children.indexOf(anchor):-1;parent.children.splice(i<0?parent.children.length:i,0,node);node.parent=parent}
const renderer=createRenderer({patchProp(el,k,old,v){el.props[k]=v},insert,remove(node){if(node.parent){const i=node.parent.children.indexOf(node);if(i>=0)node.parent.children.splice(i,1)}},createElement(tag){return{tag,children:[],props:{}}},createText(text){return{text,children:[]}},createComment(){return{children:[]}},setText(n,t){n.text=t},setElementText(n,t){n.children=[{text:t,children:[]}]},parentNode:n=>n.parent,nextSibling(n){const s=n.parent?.children||[];return s[s.indexOf(n)+1]||null},insertStaticContent(text,parent,anchor){const n={text,children:[]};insert(n,parent,anchor);return[n,n]}})
const text=n=>[n.text||'',...(n.children||[]).map(text)].join(' ')
const find=(n,fn)=>fn(n)?n:(n.children||[]).map(c=>find(c,fn)).find(Boolean)
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();await nextTick()}
function mount(){const pinia=createPinia(),root={children:[]},app=renderer.createApp(component);app.use(pinia);const user=auth(pinia);app.mount(root);return{root,app,user,text:()=>text(root),click:()=>find(root,n=>n.tag==='button').props.onClick()}}
let reads=0;__donationAPI.fetchV3DonationPage=async()=>{reads++;return 'https://fishpi.cn/charge/point'}
let view=mount();await tick();assert.equal(reads,1);assert.match(view.text(),/经典站点/);const anchor=find(view.root,n=>n.props?.href==='https://fishpi.cn/charge/point');assert.equal(anchor.props.target,'_blank');assert.equal(anchor.props.rel,'noopener noreferrer');assert.ok(!find(view.root,n=>n.tag==='input'||n.tag==='img'));view.user.accessToken='B';await tick();assert.equal(reads,1);view.click();await tick();assert.equal(reads,2);view.app.unmount()
console.log('PASS donation 2 actual Vue provides explicit classic-page anchor with no order inputs/QR; ordinary token rotation preserves link')
__donationAPI.fetchV3DonationPage=async()=>{throw Error('捐助入口临时不可用')};view=mount();await tick();assert.match(view.text(),/临时不可用/);assert.ok(!find(view.root,n=>n.props?.href==='https://fishpi.cn/charge/point'));__donationAPI.fetchV3DonationPage=async()=> 'https://fishpi.cn/charge/point';view.click();await tick();assert.ok(find(view.root,n=>n.props?.href==='https://fishpi.cn/charge/point'));view.user.accessToken=null;await tick();assert.match(view.text(),/登录后读取/);assert.ok(!find(view.root,n=>n.props?.href==='https://fishpi.cn/charge/point'));view.app.unmount()
let release;__donationAPI.fetchV3DonationPage=async()=>new Promise(r=>release=r);view=mount();await tick();state.context++;__donationAPI.fetchV3DonationPage=async()=> 'https://new.example/charge/point';view.user.account={oId:'2'};view.user.accessToken='C';await tick();release('https://old.example/charge/point');await tick();assert.match(view.text(),/new.example/);assert.ok(!view.text().includes('old.example'));view.app.unmount()
globalThis.window={location:{origin:'https://fishpi.cn'}};__donationAPI.fetchV3DonationPage=async()=> 'https://fishpi.cn/charge/point';view=mount();await tick();assert.match(view.text(),/指向当前页面/);assert.ok(!find(view.root,n=>n.props?.href==='https://fishpi.cn/charge/point'));view.app.unmount();delete globalThis.window
console.log('PASS donation 3 failure/retry and logout/new owner discard stale link and delayed old response')
let ssrReads=0;__donationAPI.fetchV3DonationPage=async()=>{ssrReads++;throw Error('SSR')};const ssr=createSSRApp(component);ssr.use(createPinia());const html=await renderToString(ssr);assert.equal(ssrReads,0);assert.match(html,/正在准备/);assert.ok(!source.includes('/pay/wechat')&&!source.includes('QRcode_url'))
console.log('PASS donation 4 SSR never requests private link or creates order; old payment transport removed')
