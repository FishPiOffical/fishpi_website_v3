import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse,compileScript } from '@vue/compiler-sfc'
import { createSSRApp,reactive } from 'vue'
import { renderToString } from 'vue/server-renderer'
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const route=reactive({path:'/member/A/followers',params:{userName:'A'}}),auth=reactive({isLoggedIn:true,account:{userName:'A'}})
globalThis.__memberTabs={route,auth}
const router=url(`import{h}from '${import.meta.resolve('vue')}';export const useRoute=()=>globalThis.__memberTabs.route;export const RouterLink={props:['to'],setup(p,{slots,attrs}){return()=>h('a',{...attrs,href:p.to},slots.default?.())}}`),authShim=url('export const useAuthStore=()=>globalThis.__memberTabs.auth')
const source=await fs.readFile('src/components/member/MemberTabs.vue','utf8'),d=parse(source).descriptor
async function component(mounted=false){let s=compile(compileScript(d,{id:'member-tabs',inlineTemplate:true}).content);if(mounted)s=s.replace('ref(false)','ref(true)');for(const[k,v]of[['vue',import.meta.resolve('vue')],['vue-router',router],['@/stores/auth',authShim]])s=s.replaceAll(`from '${k}'`,`from '${v}'`).replaceAll(`from "${k}"`,`from '${v}'`);return(await import(url(s))).default}
const c=await component(),client=await component(true)
for(const path of ['','/long','/comments','/medals','/followers','/following/users','/following/tags','/following/articles','/watching/articles','/breezemoons/123']){
 route.path='/member/A'+path;const html=await renderToString(createSSRApp(c));assert.match(html,/关注用户/);assert.match(html,/公开勋章/);assert.match(html,/收藏帖子/);assert.equal((html.match(/aria-current="page"/g)||[]).length,1);assert.ok(!html.includes('匿贴'));assert.ok(!html.includes('我的积分'))
}
route.path='/member/A/articles/anonymous';let html=await renderToString(createSSRApp(client));assert.ok(html.includes('匿贴'));assert.match(html,/aria-current="page"[^>]*>匿贴/);assert.ok(html.includes('/member/A/points'))
auth.account.userName='B';html=await renderToString(createSSRApp(client));assert.ok(!html.includes('匿贴'));assert.ok(!html.includes('我的积分'))
route.params.userName='A B/中文';html=await renderToString(createSSRApp(c));assert.ok(html.includes('/member/A%20B%2F%E4%B8%AD%E6%96%87'))
const shell=await fs.readFile('src/layouts/AppShell.vue','utf8');assert.equal((shell.match(/<MemberLayout /g)||[]).length,1);const layout=await fs.readFile('src/components/member/MemberLayout.vue','utf8');assert.equal((layout.match(/<MemberTabs /g)||[]).length,1);assert.ok(layout.includes('<MemberProfileCard '));assert.ok(!source.includes('的主页</RouterLink>'))
const points=await fs.readFile('src/views/MemberPointsView.vue','utf8');assert.ok(points.includes('<PointsView v-if="own"'));assert.ok(points.includes('mounted.value && auth.isLoggedIn'));assert.ok((await fs.readFile('src/router/index.ts','utf8')).includes("import('@/views/MemberPointsView.vue')"))
console.log('PASS all member subroutes share persistent tabs, exact/deep active item, encoded target; SSR hides private tabs, owner-only points gate')
