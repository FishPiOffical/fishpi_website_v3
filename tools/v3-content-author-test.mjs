import { nicknameFixtureURL, nicknameFixtureCalls, nicknameFixtureStyles } from './helpers/v3-nickname-fixture.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const http = url('export class ApiError extends Error{};export function request(){throw Error("unexpected HTTP")}')
const apiURL = url(compile(await fs.readFile('src/api/v3-content.ts', 'utf8')).replace("from './http'", `from '${http}'`))
const api = await import(apiURL)
const signed = "https://example.test/a'b.png?sig=a%2Bb+c&x=1&x=2#literal"
const author = { id:'3', userName:'actual_user', userNickname:'新昵称 <b>literal</b>', userAvatarURL:signed }
const raw = { id:'101', title:'Title', preview:'Preview', tags:'', type:0, anonymous:false, author, createdAt:1, viewCount:0, commentCount:1 }
const article = api.adaptV3Article(raw)
const comment = api.adaptV3Comment({ id:'201', parentId:'', anonymous:false, author, contentVisible:true, contentHtml:'<p>Body</p>', createdAt:1 })
assert.equal(article.articleAuthorNickname, author.userNickname)
assert.equal(comment.commentAuthorNickname, author.userNickname)
assert.equal(article.articleAuthorName,'actual_user')
assert.equal(comment.commentAuthorName,'actual_user')
assert.equal(article.articleAuthorThumbnailURL48,signed)
console.log('PASS content author 1 actual adapter preserves nickname, routing username and complete signed URL separately')
for (const safe of [api.adaptV3Article({...raw,anonymous:true}),api.adaptV3Comment({id:'202',parentId:'',anonymous:true,author,contentVisible:false,createdAt:1})]) {
 assert.ok(!JSON.stringify(safe).includes(author.userNickname));assert.ok(!JSON.stringify(safe).includes(author.userName));assert.ok(!JSON.stringify(safe).includes(signed))
}
console.log('PASS content author 2 anonymous projection never recovers identifying aliases even from malformed upstream author')
const avatar = await import(url(compile(await fs.readFile('src/utils/avatar.ts','utf8'))))
assert.equal(avatar.avatarStyle(signed).backgroundImage,`url("${signed}")`)
assert.equal(avatar.avatarStyle('').backgroundImage,`url("${avatar.DEFAULT_AVATAR}")`)
assert.ok(!avatar.avatarStyle('https://example.test/a"b\\c\n').backgroundImage.includes('\n'))
console.log('PASS content author 3 CSS URL quotes remain valid for apostrophes and encoded signature parameters; empty avatar uses default')
const router=url(`import{h}from'${import.meta.resolve('vue')}';export const RouterLink={props:['to'],setup:(p,{slots,attrs})=>()=>h('a',{...attrs,href:p.to},slots.default?.())}`)
const empty=url('export default {render(){return null}}')
const textUtility=url(compile(await fs.readFile('src/utils/text.ts','utf8')))
async function component(file){
 const descriptor=parse(await fs.readFile(file,'utf8')).descriptor
 let output=compile(compileScript(descriptor,{id:file,inlineTemplate:true}).content)
 output=output.replace(/from\s+(['"])([^'"]+)\1/g,(whole,q,name)=>`from '${name==='vue'?import.meta.resolve('vue'):name==='vue-router'?router:name==='@/utils/avatar'?url(compileAvatar):name==='@/utils/text'?textUtility:name==='@/components/user/VipNickname.vue'?nicknameFixtureURL:name.endsWith('.vue')?empty:name}'`)
 return (await import(url(output))).default
}
const compileAvatar=compile(await fs.readFile('src/utils/avatar.ts','utf8'))
const Feed=await component('src/components/articles/ArticleFeed.vue'),Comment=await component('src/components/CommentItem.vue')
const render=(Component,props)=>renderToString(createSSRApp({render:()=>h(Component,props)}))
for(const compact of [false,true]){
 const html=await render(Feed,{items:[article],compact})
 assert.ok(html.includes('/member/actual_user'));assert.ok(!html.includes('/member/新昵称'))
 assert.ok(html.includes('新昵称 &lt;b&gt;literal&lt;/b&gt;'));assert.ok(!html.includes('<b>literal</b>'))
 assert.ok(html.includes('sig=a%2Bb+c&amp;x=1&amp;x=2#literal'))
 const hidden=await render(Feed,{items:[api.adaptV3Article({...raw,anonymous:true})],compact})
 assert.ok(!hidden.includes('/member/'));assert.ok(!hidden.includes('actual_user'));assert.ok(!hidden.includes('新昵称'))
}
console.log('PASS content author 4 actual full/compact feed SSR labels escape nickname and link only routing username; anonymous authors have no profile link')
const html=await render(Comment,{comment})
assert.ok(html.includes('/member/actual_user'));assert.ok(html.replace(/<[^>]*>/g,'').includes('新昵称 &lt;b&gt;literal&lt;/b&gt;'));assert.ok(!html.includes('/member/新昵称'))
const hidden=await render(Comment,{comment:api.adaptV3Comment({id:'202',parentId:'',anonymous:true,author,contentVisible:false,createdAt:1})})
assert.ok(!hidden.includes('/member/'));assert.ok(!hidden.includes('actual_user'));assert.ok(!hidden.includes('新昵称'))
console.log('PASS content author 5 actual comment SSR displays escaped nickname without changing reply identity or anonymous routing')

const columns = url('export function decodePublicColumnCard(){throw Error("unexpected column")};export function fetchPublicColumnCards(){throw Error("unexpected HTTP")}')
const listing = await import(url(compile(await fs.readFile('src/api/v3-article-list.ts','utf8')).replace("from './http'",`from '${http}'`).replace("from './v3-content'",`from '${apiURL}'`).replace("from './v3-public-columns'",`from '${columns}'`)))
assert.equal(listing.decodePublicArticleSummary(article).articleAuthorNickname,author.userNickname)
assert.equal(listing.decodePublicArticleSummary(article).articleAuthorThumbnailURL48,signed)
assert.equal(listing.decodePublicArticleSummary({...article,articleAuthorNickname:undefined}).articleAuthorNickname,'')
assert.ok(!JSON.stringify(listing.decodePublicArticleSummary({...article,articleAnonymous:1})).includes(author.userNickname))
console.log('PASS content author 6 SSR bootstrap reprojection preserves nickname and signed URL without recovering anonymous aliases; old bootstrap has username fallback')

nicknameFixtureStyles.set('3',{class:'verified-style-id-3',style:{color:'#123456'}})
for(const [Component,props] of [[Feed,{items:[article]}],[Comment,{comment}]]){
 nicknameFixtureCalls.length=0;const styled=await render(Component,props)
 assert.ok(styled.includes('verified-style-id-3'));assert.ok(styled.replace(/<[^>]*>/g,'').includes('新昵称 &lt;b&gt;literal&lt;/b&gt;'));assert.ok(nicknameFixtureCalls.some(x=>x.id==='3'&&x.name==='actual_user'))
 assert.ok(nicknameFixtureCalls.every(x=>x.id==='3'));assert.ok(styled.includes('/member/actual_user'))
}
console.log('PASS content author 7 actual feed/comment templates pass public ID and routing username to actual nickname SFC while keeping escaped display nickname')
nicknameFixtureCalls.length=0
await render(Feed,{items:[api.adaptV3Article({...raw,anonymous:true})]});await render(Comment,{comment:api.adaptV3Comment({id:'202',parentId:'',anonymous:true,author,contentVisible:false,createdAt:1})})
assert.deepEqual(nicknameFixtureCalls,[])
console.log('PASS content author 8 anonymous feed/comment hosts never mount nickname styles or pass identifying user props')

for(const compact of [false,true]){
 const selected=api.adaptV3Article({...raw,perfect:true}),normal=api.adaptV3Article({...raw,perfect:false})
 assert.equal(selected.articlePerfect,1)
 const projected=listing.decodePublicArticleSummary(selected);assert.equal(projected.articlePerfect,1)
 const selectedHTML=await render(Feed,{items:[projected],compact});assert.ok(selectedHTML.includes('title="优选"'))
 const normalHTML=await render(Feed,{items:[listing.decodePublicArticleSummary(normal)],compact});assert.ok(!normalHTML.includes('title="优选"'))
}
for(const articlePerfect of [true,'1',2,-1,null])assert.throws(()=>listing.decodePublicArticleSummary({...article,articlePerfect}))
console.log('PASS content author 9 perfect survives actual API/SSR reprojection and full/compact feed rendering; ordinary and malformed flags cannot create a badge')
