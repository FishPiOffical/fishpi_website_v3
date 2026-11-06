import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createRenderer, createSSRApp, h, nextTick, ref, reactive } from 'vue'
import { createPinia, defineStore } from 'pinia'
import { renderToString } from '@vue/server-renderer'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
globalThis.__anonymous={context:1,requests:[],responses:[]};const state=__anonymous
const http=url(`export class ApiError extends Error{constructor(message,status=0,code){super(message);this.status=status;this.code=code}}export function getAuthContextVersion(){return globalThis.__anonymous.context}export async function request(path,init){globalThis.__anonymous.requests.push({path,init});const value=globalThis.__anonymous.responses.shift();if(value instanceof Error)throw value;return value}`)
const api=await import(url(compile(await fs.readFile('src/api/v3-anonymous-content.ts','utf8')).replace("from './http'",`from '${http}'`)))
const article={id:'101',title:'<b>标题字面文本</b>',type:0,createdAt:1700000000000,updatedAt:1700000000010},comment={id:'201',articleId:'101',articleTitle:'所属文章',createdAt:1700000000020,visibility:1}
const env=data=>({code:0,data}), page=(list,p=1,total=list.length)=>({list,pagination:{p,size:20,total,pageCount:Math.ceil(total/20)}})
state.responses.push(env(page([{...article,articleContent:'private',userPassword:'private',articleAuthorId:'1'}])));const projected=await api.fetchV3AnonymousContent('articles');assert.deepEqual(projected.list,[article]);assert.deepEqual(state.requests[0],{path:'/api/v3/me/anonymous-articles?p=1&size=20',init:{cache:'no-store'}})
state.responses.push(env(page([{...comment,commentContent:'private',commentAuthorId:'1'}])));assert.deepEqual((await api.fetchV3AnonymousContent('comments')).list,[comment])
for(const [kind,p,size] of [['other',1,20],['articles',0,20],['comments',42949673,20],['articles',1,51]])await assert.rejects(api.fetchV3AnonymousContent(kind,p,size),e=>e.status===422)
for(const bad of [null,{code:1},env({list:[],pagination:{p:1,size:20,total:21,pageCount:1}}),env(page([{...article,id:'x'}])),env(page([{...article,type:7}])),env(page([{...article,createdAt:9e15}])),env(page([article,article]))]){state.responses.push(bad);await assert.rejects(api.fetchV3AnonymousContent('articles'),e=>e.status===502)}
state.responses.push(env(page([{...comment,visibility:2}])));await assert.rejects(api.fetchV3AnonymousContent('comments'))
console.log('PASS anonymous 1 owner-only fixed paths, exact pagination/metadata projection, invalid responses and parameters rejected')
const auth=defineStore('anonymous-auth',()=>({accessToken:ref('A'),account:ref({oId:'1',userName:'owner'})}));globalThis.__anonymousAuth=auth;globalThis.__anonymousAPI={...api};globalThis.__anonymousRoute=reactive({fullPath:'/member/owner/articles/anonymous',path:'/member/owner/articles/anonymous',params:{userName:'owner'},meta:{memberTab:'articlesAnonymous'}})
const apiURL=url(`export const fetchV3AnonymousContent=(...args)=>globalThis.__anonymousAPI.fetchV3AnonymousContent(...args)`),authURL=url('export const useAuthStore=globalThis.__anonymousAuth'),seoURL=url('export function usePageSeo(){}'),routerURL=url(`import{h}from'${import.meta.resolve('vue')}';export function useRoute(){return globalThis.__anonymousRoute};export const RouterLink={props:['to'],setup:(p,{slots})=>()=>h('a',{href:typeof p.to==='string'?p.to:p.to.path},slots.default?.())}`)
const source=await fs.readFile('src/views/AnonymousContentView.vue','utf8'),descriptor=parse(source).descriptor
let code=compile(compileScript(descriptor,{id:'anonymous-test',inlineTemplate:true}).content)
for(const [from,to]of [['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['vue-router',routerURL],['@/api/http',http],['@/api/v3-anonymous-content',apiURL],['@/stores/auth',authURL],['@/composables/usePageSeo',seoURL]])code=code.replace(new RegExp(`from ['"]${from.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}['"]`,'g'),`from '${to}'`)
const component=(await import(url(code))).default
const insert=(node,parent,anchor)=>{if(node.parent){const i=node.parent.children.indexOf(node);if(i>=0)node.parent.children.splice(i,1)}const i=anchor?parent.children.indexOf(anchor):-1;parent.children.splice(i<0?parent.children.length:i,0,node);node.parent=parent}
const renderer=createRenderer({patchProp(el,k,old,v){el.props[k]=v},insert,remove(node){if(node.parent){const i=node.parent.children.indexOf(node);if(i>=0)node.parent.children.splice(i,1)}},createElement(tag){return{tag,children:[],props:{}}},createText(text){return{text,children:[]}},createComment(){return{children:[]}},setText(n,t){n.text=t},setElementText(n,t){n.children=[{text:t,children:[]}]},parentNode:n=>n.parent,nextSibling(n){const s=n.parent?.children||[];return s[s.indexOf(n)+1]||null},insertStaticContent(text,parent,anchor){const n={text,children:[]};insert(n,parent,anchor);return[n,n]}})
const text=n=>[n.text||'',...(n.children||[]).map(text)].join(' ')
const find=(n,fn)=>fn(n)?n:(n.children||[]).map(c=>find(c,fn)).find(Boolean)
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();await nextTick()}
function mount(){const pinia=createPinia(),root={children:[]},app=renderer.createApp(component);app.use(pinia);const user=auth(pinia);app.mount(root);return{root,app,user,text:()=>text(root),click:()=>find(root,n=>n.tag==='button').props.onClick()}}

const click=(view,label)=>{const button=find(view.root,n=>n.tag==='button'&&text(n).trim()===label);assert.ok(button,'Missing '+label);button.props.onClick()}
let reads=[];__anonymousAPI.fetchV3AnonymousContent=async(kind,p)=>{reads.push({kind,p});return{list:[{...article,id:String(100+p),title:p===1?'FIRST':'SECOND'}],p,size:20,total:21,pageCount:2}}
let view=mount();await tick();assert.match(view.text(),/FIRST/);assert.ok(!view.text().includes('正文内容'));click(view,'下一页');await tick();assert.match(view.text(),/SECOND/);assert.deepEqual(reads,[{kind:'articles',p:1},{kind:'articles',p:2}]);const next=find(view.root,n=>n.tag==='button'&&text(n).trim()==='下一页');assert.equal(next.props.disabled,true);view.user.accessToken='B';await tick();assert.equal(reads.length,2);view.app.unmount()
console.log('PASS anonymous 2 actual Vue uses true page count/last page and keeps page during normal token rotation')
__anonymousAPI.fetchV3AnonymousContent=async(kind,p)=>{if(p===2)throw Error('暂不可用503');return{list:[article],p,size:20,total:21,pageCount:2}};view=mount();await tick();assert.match(view.text(),/<b>标题字面文本<\/b>/);assert.ok(!find(view.root,n=>n.tag==='b'));click(view,'下一页');await tick();assert.match(view.text(),/暂不可用503/);assert.ok(!view.text().includes('暂无当前'));click(view,'返回第一页');await tick();assert.match(view.text(),/标题字面文本/);view.app.unmount()
__anonymousRoute.meta.memberTab='commentsAnonymous';__anonymousAPI.fetchV3AnonymousContent=async()=>({list:[comment],p:1,size:20,total:1,pageCount:1});view=mount();await tick();assert.match(view.text(),/私密评论/);assert.match(view.text(),/评论 ID：201/);assert.ok(find(view.root,n=>n.props?.href==='/article/101'));view.app.unmount()
console.log('PASS anonymous 3 page error is not empty data, recovery works, titles remain text and private-comment metadata/link stays explicit')
let releases=[];__anonymousRoute.meta.memberTab='articlesAnonymous';__anonymousAPI.fetchV3AnonymousContent=async()=>new Promise(r=>releases.push(r));view=mount();await tick();__anonymousRoute.params.userName='other';await tick();assert.match(view.text(),/仅供本人/);assert.equal(releases.length,1);releases[0]({list:[article],p:1,size:20,total:1,pageCount:1});await tick();assert.ok(!view.text().includes('标题字面文本'));view.app.unmount()
let blockedReads=0;__anonymousAPI.fetchV3AnonymousContent=async()=>{blockedReads++;throw Error('must not request')};view=mount();await tick();assert.equal(blockedReads,0);view.app.unmount();__anonymousRoute.params.userName='owner'
let releaseOld;__anonymousAPI.fetchV3AnonymousContent=async()=>new Promise(r=>releaseOld=r);view=mount();await tick();view.user.accessToken=null;await tick();releaseOld({list:[article],p:1,size:20,total:1,pageCount:1});await tick();assert.match(view.text(),/登录后查看/);assert.ok(!view.text().includes('标题字面文本'));view.app.unmount()
console.log('PASS anonymous 4 foreign target performs no owner lookup; logout/target change discard late private metadata')
let ssrReads=0;__anonymousAPI.fetchV3AnonymousContent=async()=>{ssrReads++;throw Error('SSR')};const ssr=createSSRApp(component);ssr.use(createPinia());const html=await renderToString(ssr);assert.equal(ssrReads,0);assert.match(html,/正在准备本人内容/)
const routes=await fs.readFile('src/router/index.ts','utf8'),member=await fs.readFile('src/views/MemberView.vue','utf8');assert.ok(routes.includes("import('@/views/AnonymousContentView.vue')"));assert.ok(!member.includes("articlesAnonymous: 'GET /api/user/")&&!member.includes("commentsAnonymous: 'GET /api/user/"));assert.ok(!source.includes('fetchUserProfile')&&!source.includes('apiKey')&&!source.includes('v-html'))
console.log('PASS anonymous 5 SSR/private isolation and existing route integration do not depend on public legacy profile or raw HTML')
