import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const state=globalThis.__legacyContent={calls:[],data:null,key:null,mode:'v1'}
const shim=url(`export class ApiError extends Error{constructor(m,s){super(m);this.status=s}}export async function request(p){__legacyContent.calls.push(p);return{code:0,data:__legacyContent.data}}`),mode=url('export const getApiMode=()=>__legacyContent.mode')
const replace=(s,pairs)=>{for(const [a,b]of pairs)s=s.replaceAll(`from '${a}'`,`from '${b}'`);return s}
const contentURL=url(replace(compile(await fs.readFile('src/api/v3-content.ts','utf8')),[['./mode',mode],['./http',shim]]))
const columnsURL=url(replace(compile(await fs.readFile('src/api/v3-public-columns.ts','utf8')),[['./mode',mode],['./http',shim],['./v3-content',contentURL]]))
const homeURL=url(replace(compile(await fs.readFile('src/api/legacy/home.ts','utf8')),[['../http',shim],['../v3-content',contentURL],['../v3-public-columns',columnsURL]]))
const authURL=url('export const getLegacyKey=()=>__legacyContent.key')
const {legacyArticle,legacyListing,legacyComment}=await import(url(replace(compile(await fs.readFile('src/api/legacy/content.ts','utf8')),[['../http',shim],['./auth',authURL],['./home',homeURL]])))
const listingURL=url(replace(compile(await fs.readFile('src/api/v3-article-list.ts','utf8')),[['./mode',mode],['./http',shim],['./v3-content',contentURL],['./v3-public-columns',columnsURL]])),{decodeArticleListing}=await import(listingURL)
const article={oId:'123',articleAnonymous:0,articleTitle:'文章标题',articleType:0,articleTags:'分享',articlePreviewContent:'简介',articleCreateTimeStr:'2026-11-04 12:00:00',articleViewCount:0,articleCommentCount:2,articleAuthorId:'7',articleAuthorName:'author',articleAuthorThumbnailURL48:'https://example.invalid/avatar',articleAuthor:{userNickname:'作者昵称'}}
state.data={articles:[article],pagination:{paginationPageCount:3}}
let value=await legacyListing('recent','',2)
assert.equal(value.total,null);assert.equal(value.pageCount,3);assert.match(state.calls.at(-1),/p=2/)
const projected=decodeArticleListing({...value,kind:'recent',extra:'',order:'recent',resource:'articles'},'recent','','recent',2)
assert.equal(projected.total,null);assert.equal(projected.list[0].articleAuthorName,'author');assert.equal(projected.list[0].articleAuthorNickname,'作者昵称')
state.mode='v3';assert.throws(()=>decodeArticleListing({...value,kind:'recent',extra:'',order:'recent',resource:'articles'},'recent','','recent',2));state.mode='v1'
console.log('PASS v1 true pageCount with unknown total; v3 still rejects unknown totals; name/nickname remain separate')
const comment={oId:'44',commentAnonymous:1,commentAuthorId:'sensitive',commentAuthorName:'private-user',commentAuthorNickName:'private-nick',commentAuthorThumbnailURL:'private-avatar',commentContent:'<p>匿名评论</p>',commentCreateTimeStr:'2026-11-04 12:01:00',commentOriginalCommentId:'',commentParagraphId:''}
state.data={article:{...article,articleContent:'<p>正文</p>',articleComments:[comment],userPassword:'must not project',articleRewardPoint:5,rewarded:false,articleRewardContent:'must not project'},pagination:{paginationPageCount:2}}
state.key='synthetic-legacy'
value=await legacyArticle('123',2)
assert.equal(value.pagination.paginationCurrentPageNum,2);assert.equal(value.pagination.paginationPageCount,2);assert.equal(value.userPassword,undefined);assert.equal(value.articleRewardContent,undefined)
assert.equal(value.articleComments[0].commentAuthorId,'');assert.equal(value.articleComments[0].commentAuthorName,'匿名用户');assert.equal(value.articleComments[0].commentAuthorThumbnailURL,'');assert.match(state.calls.at(-1),/apiKey=synthetic-legacy/)
assert.equal(value.articleCreateTimeStr,'2026-11-04T04:00:00.000Z');assert.equal(value.articleOriginalContent,undefined)
console.log('PASS article/detail current whitelist, paid hidden content never projected, anonymous comments stripped and local time normalized')
assert.throws(()=>legacyComment({...comment,commentAnonymous:undefined}))
state.data.article.oId='456';await assert.rejects(legacyArticle('123'))
await assert.rejects(legacyArticle('../123'));await assert.rejects(legacyListing('tag','some-tag',1))
state.data={articles:[],pagination:{paginationPageCount:0,paginationRecordCount:0}}
value=await legacyListing('recent','',1);assert.equal(value.total,0);assert.deepEqual(value.list,[])
console.log('PASS invalid identity/targets fail explicitly; legitimate empty and true zero remain independent of read failures')

const colSource=compile(await fs.readFile('src/api/legacy/columns.ts','utf8'))
const {legacyColumnDetail,legacyColumnPage}=await import(url(replace(colSource,[['../http',shim],['./home',homeURL],['../v3-public-columns',columnsURL]])))
const rawRead=(await import(shim)).request
// Shared transport fixture can route individual resources without faking DOM or pagination.
const routing=url(`export class ApiError extends Error{constructor(m,s){super(m);this.status=s}}export async function request(p){__legacyContent.calls.push(p);return{code:0,data:__legacyContent.route(p)}}`)
const routedHome=url(replace(compile(await fs.readFile('src/api/legacy/home.ts','utf8')),[['../http',routing],['../v3-content',contentURL],['../v3-public-columns',columnsURL]]))
const routedColumns=await import(url(replace(colSource,[['../http',shim],['./home',routedHome],['../v3-public-columns',columnsURL]])))
const chapter=n=>({articleId:String(1000+n),articleTitle:'章节'+n,chapterNo:n,articleCreateTime:'2026-11-04 12:00:00'})
state.route=p=>p.includes('/articles')?{articles:p.includes('p=2')?[chapter(21)]:Array.from({length:20},(_,i)=>chapter(i+1)),pagination:{paginationRecordCount:21,paginationPageCount:2}}:{columnId:'123',columnTitle:'完整目录',columnArticleCount:21}
const col=await routedColumns.legacyColumnDetail('123')
assert.equal(col.column.articleCount,21);assert.equal(col.first.chapterNo,1);assert.equal(col.latest.chapterNo,21)
assert.equal((await routedColumns.legacyColumnPage('123',2)).list.length,1)
state.route=p=>p.includes('/articles')?{articles:[],pagination:{paginationRecordCount:0,paginationPageCount:1}}:{columnId:'123',columnTitle:'接口目录不一致',columnArticleCount:68}
await assert.rejects(routedColumns.legacyColumnDetail('123'),e=>e.status===503)
console.log('PASS complete multi-page column directory gives genuine first/latest; inconsistent metadata versus empty directory fails rather than two-chapter fallback')
state.key=null
state.data={articles:[article],pagination:{paginationPageCount:2}}
const tag=await legacyListing('tag','分享/技巧',1)
assert.equal(tag.list.length,1);assert.match(state.calls.at(-1),/\/api\/articles\/tag\/%E5%88%86%E4%BA%AB%2F%E6%8A%80%E5%B7%A7\?p=1/)
assert.ok(!state.calls.at(-1).includes('%25E5'))
const directory=await import(url(replace(compile(await fs.readFile('src/api/legacy/directory.ts','utf8')),[['../http',shim],['./home',homeURL]])))
state.data={domains:[{domainURI:'tech&life',domainTitle:'技术与生活',domainDescription:'介绍',domainIconPath:'javascript:evil',articleCnt:7,private:'drop'}]}
const domains=await directory.legacyDirectory('domains',1)
assert.equal(domains.total,1);assert.equal(domains.list[0].uri,'tech&life');assert.equal(domains.list[0].domainIconPath,'');assert.equal(domains.list[0].private,undefined)
const again=directory.decodeLegacyDirectoryPage(domains,'domains',1);assert.equal(again.list[0].domainArticleCount,7)
const tagItem={tagURI:'分享/技巧',tagTitle:'分享/技巧',tagDescription:'说明',tagIconPath:'/icon.png',tagReferenceCount:0}
state.data={tags:[tagItem],total:51,pagination:{paginationPageCount:2}}
const tags=await directory.legacyDirectory('tags',2)
assert.equal(tags.list.length,1);assert.equal(tags.total,51);assert.equal(tags.pageCount,2);assert.equal(tags.list[0].tagReferenceCount,0)
assert.deepEqual(directory.decodeLegacyDirectoryPage(tags,'tags',2),tags)
await assert.rejects(directory.legacyDirectory('tags',1))
state.data={tags:[],total:0,pagination:{paginationPageCount:0}}
assert.equal((await directory.legacyDirectory('tags',1)).total,0)
console.log('PASS real legacy tag slugs encode once; finite domain snapshot and true paginated tags preserve URI/counts, sanitize icons and SSR reproject')
const {legacyDate}=await import(homeURL)
assert.equal(new Date(legacyDate('Sun Sep 20 22:35:18 CST 2026')).toISOString(),'2026-09-20T14:35:18.000Z')
state.data={articles:[{...article,articleAnonymous:undefined,articleCreateTimeStr:undefined,articleCreateTime:'Sun Sep 20 22:35:18 CST 2026',articleAuthor:{oId:'sensitive',userName:'must-not-link',userNickname:'must-not-display'}}],total:1,pagination:{paginationPageCount:1}}
const search=await legacyListing('search','查询 & 测试',1)
assert.equal(search.total,1);assert.equal(search.list[0].articleIdentityUnavailable,true);assert.equal(search.list[0].articleAnonymous,undefined);assert.equal(search.list[0].articleAuthorName,'')
const searchProjection=decodeArticleListing({...search,kind:'search',extra:'查询 & 测试',order:'recent',resource:'articles'},'search','查询 & 测试','recent',1)
assert.equal(searchProjection.list[0].articleAuthorId,'');assert.equal(searchProjection.list[0].articleIdentityUnavailable,true)
assert.match(state.calls.at(-1),/key=/);assert.ok(!state.calls.at(-1).includes('key=查询'))
state.mode='v3';assert.throws(()=>decodeArticleListing({...search,kind:'search',extra:'查询 & 测试',order:'recent',resource:'articles'},'search','查询 & 测试','recent',1));state.mode='v1'
console.log('PASS legacy search masks unknown anonymity instead of nested identity inference; key encoding and China CST timestamps are correct; v3 rejects unknown identity')
