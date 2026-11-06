import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../src/api/v3-content.ts', import.meta.url), 'utf8')
const shim = `export class ApiError extends Error { constructor(message,status,code){super(message);this.status=status;this.code=code} } export async function request(path){globalThis.__v3Paths.push(path);const next=globalThis.__v3Responses.shift();if(next instanceof Error)throw next;if(next===undefined)throw Error('Unexpected request '+path);return next}`
const shimUrl = `data:text/javascript;base64,${Buffer.from(shim).toString('base64')}`
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace("from './http'", `from '${shimUrl}'`)
const api = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const author = { id: '3', userName: 'reader', userNickname: '昵称', userAvatarURL: 'https://example.test/a.png' }
const article = { id: '101', title: '<title>', preview: '真实摘要', tags: 'a,b', type: 0, anonymous: false, author, createdAt: 1, viewCount: 8, commentCount: 2 }
const comment = { id: '201', articleId: '101', parentId: '', content: 'private', contentHtml: '<b>private</b>', contentVisible: false, anonymous: true, author, createdAt: 2 }
const page = (list, p = 1, total = list.length, size = 20) => ({ list, pagination: { p, size, total, pageCount: Math.ceil(total / size) } })
const reset = (...responses) => { globalThis.__v3Responses = responses.map(data => data instanceof Error ? data : ({ code: 0, data })); globalThis.__v3Paths = [] }
const adapted = api.adaptV3Article(article)
assert.equal(adapted.oId, '101'); assert.equal(adapted.articleAuthorId, '3'); assert.equal(adapted.articleTitle, '<title>')
assert.equal('articleVote' in adapted, false); assert.equal('articlePerfect' in adapted, false)
assert.equal(api.adaptV3Article({ ...article, anonymous: true }).articleAuthorId, '')
assert.equal(api.adaptV3Comment(comment).commentContent, ''); assert.equal(api.adaptV3Comment(comment).commentAuthorId, '')
assert.throws(() => api.adaptV3Article({ ...article, id: 101 }), /格式/)
reset(page([])); assert.deepEqual(await api.v3RecentArticles(), []); assert.match(globalThis.__v3Paths[0], /^\/api\/v3\/articles\?/)
reset(new Error('backend down')); await assert.rejects(api.v3RecentArticles(), /backend down/); assert.equal(globalThis.__v3Paths.length, 1)
reset(page([article])); assert.equal((await api.v3Search(' x & y '))[0].oId, '101'); assert.match(globalThis.__v3Paths[0], /q=x%20%26%20y/)
for (const [kind, sort, type] of [['good', 'hot', 'recent'], ['hot', 'month-comments', 'recent'], ['reply', 'active', 'recent'], ['qna', 'latest', 'qna'], ['perfect', 'latest', 'perfect'], ['long', 'latest', 'long']]) {
  reset(page([article])); await api.v3ArticleFeed(kind)
  assert.match(globalThis.__v3Paths[0], new RegExp(`sort=${sort}&type=${type}$`))
}
reset(); await assert.rejects(api.v3ArticleFeed('unsupported'), error => error.status === 422); assert.equal(globalThis.__v3Paths.length, 0)
reset(page([{ id: '7', uri: '开发', title: '开发', description: '', iconURL: '', articleCount: 0 }], 1, 1, 50), page([article]))
assert.equal((await api.v3ArticleFeed('tag', 1, 20, '开发'))[0].oId, '101'); assert.match(globalThis.__v3Paths[1], /^\/api\/v3\/tags\/7\/articles\?/)
reset(page([{ id: '8', uri: 'tech', title: '技术', description: '', iconURL: '' }], 1, 1, 50)); assert.equal((await api.v3Domains())[0].uri, '8')
reset({ ...article, contentFormat: 'markdown', content: '**source**', contentHtml: '<strong>source</strong>', rewardPoint: 20, rewarded: false, rewardContent: 'should not leak', rewardContentHtml: '<b>should not leak</b>' }, page([comment]))
const detail = await api.v3Article('101'); assert.equal(detail.articleContent, '<strong>source</strong>'); assert.equal(detail.articleRewardContent, ''); assert.equal(detail.articleComments[0].commentContent, '')
assert.equal(detail.pagination.paginationPageCount, 1); assert.equal(globalThis.__v3Paths.length, 2)
reset(); await assert.rejects(api.v3Article('invalid'), error => error.status === 422); assert.equal(globalThis.__v3Paths.length, 0)
assert.throws(() => api.decodeV3ContentPage({ list: [], pagination: { p: 1, size: 20, total: 21, pageCount: 1 } }), /格式/)
const pinned = api.adaptV3Article({ ...article, stick: { active: true, permanent: true, expiresAt: null, internal: 'private' } })
assert.deepEqual(pinned.stick, { active: true, permanent: true, expiresAt: null })
assert.equal(api.adaptV3Article({ ...article, stick: { active: false, permanent: false, expiresAt: 0 } }).stick.active, false)
assert.throws(() => api.adaptV3Article({ ...article, stick: { active: true, permanent: true, expiresAt: 123 } }), /格式/)
assert.throws(() => api.adaptV3Article({ ...article, stick: { active: true, permanent: false, expiresAt: Number.MAX_SAFE_INTEGER + 1 } }), /格式/)
console.log('PASS v3 content: DTO whitelist, hidden content, empty/error, actual paths, directory IDs, pagination')

const currentDetail={...article,contentFormat:'markdown',content:'source',contentHtml:'<p>source</p>',rewardPoint:0,rewarded:false,rewardContentHtml:''}
for(const p of [0,-1,1.5,NaN,42949673]){reset();await assert.rejects(api.v3Article('101',p),e=>e.status===422);assert.equal(globalThis.__v3Paths.length,0)}console.log('PASS article binding 1 malformed/oversized page rejected before either network request')
reset({...currentDetail,id:'102'},page([comment]));await assert.rejects(api.v3Article('101'),e=>e.status===502);console.log('PASS article binding 2 detail must match exact requested article ID')
for(const comments of [page([comment],2,21),page([comment],1,1,10)]){reset(currentDetail,comments);await assert.rejects(api.v3Article('101'),e=>e.status===502)}console.log('PASS article binding 3 comment response page and size bind to current request')
for(const row of [{...comment,articleId:'102'},{...comment,articleId:undefined},{...comment,articleId:101}]){reset(currentDetail,page([row]));await assert.rejects(api.v3Article('101'),e=>e.status===502)}console.log('PASS article binding 4 each comment must belong to exact requested article, missing/numeric binding rejected')
reset(currentDetail,page([comment,comment]));await assert.rejects(api.v3Article('101'),e=>e.status===502);console.log('PASS article binding 5 duplicate comment IDs cannot become duplicate threaded UI entries')
reset(currentDetail,page([],2,0));const empty=await api.v3Article('101',2);assert.equal(empty.pagination.paginationCurrentPageNum,2);assert.equal(empty.pagination.paginationPageCount,0);assert.deepEqual(empty.articleComments,[]);console.log('PASS article binding 6 empty/shrunk comments retain actual page metadata for caller recovery')
reset({...currentDetail,type:6},page([{...comment,articleId:'other'}]));await assert.rejects(api.v3Article('101'),e=>e.status===502);assert.equal(globalThis.__v3Paths.length,2);console.log('PASS article binding 7 invalid long-article comments fail before any paragraph-content fetch')
reset(currentDetail,page([{...comment,userPhone:'PRIVATE',commentIP:'PRIVATE'}]));const safe=await api.v3Article('101');assert.equal(safe.articleComments[0].commentContent,'');assert.equal(safe.articleComments[0].commentAuthorId,'');assert.ok(!JSON.stringify(safe).includes('PRIVATE'));console.log('PASS article binding 8 validated current binding retains private/anonymous projection and drops unknown fields')

for(const accepted of [false,true]){
 reset({...currentDetail,type:5,qna:{offerPoint:20,accepted,answerId:'PRIVATE_ANSWER',author:'PRIVATE_AUTHOR'}},page([]))
 const question=await api.v3Article('101');assert.equal(question.articleQnAOfferPoint,20);assert.equal(question.offered,accepted);assert.ok(!JSON.stringify(question).includes('PRIVATE_'))
}
reset({...currentDetail,qna:null},page([]));const ordinaryQuestion=await api.v3Article('101');assert.equal(ordinaryQuestion.articleQnAOfferPoint,undefined);assert.equal(ordinaryQuestion.offered,undefined)
console.log('PASS question projection 1 additive question state maps amount/accepted only, drops hidden answer identifiers and keeps non-question null')
for(const qna of [null,[],{}, {offerPoint:-1,accepted:false},{offerPoint:'20',accepted:false},{offerPoint:20,accepted:1},{offerPoint:20,accepted:null}]){
 reset({...currentDetail,type:5,qna},page([]));await assert.rejects(api.v3Article('101'),e=>e.status===502)
}
reset({...currentDetail,qna:{offerPoint:20,accepted:true}},page([]));await assert.rejects(api.v3Article('101'),e=>e.status===502)
reset({...currentDetail,type:5},page([]));const oldQuestion=await api.v3Article('101');assert.equal(oldQuestion.articleQnAOfferPoint,undefined);assert.equal(oldQuestion.offered,undefined)
console.log('PASS question projection 2 malformed question state rejects explicitly; older omitted state stays unknown instead of invented zero or unresolved')

assert.equal(api.adaptV3Article({...article,perfect:true}).articlePerfect,1)
assert.equal(api.adaptV3Article({...article,perfect:false}).articlePerfect,0)
assert.equal(api.adaptV3Article(article).articlePerfect,undefined)
for(const perfect of [0,1,'true',null,{}])assert.throws(()=>api.adaptV3Article({...article,perfect}),e=>e.status===502)
console.log('PASS perfect projection 1 strict boolean flag is preserved and older missing metadata stays absent')

for(const commentable of [true,false,null])for(const statement of [0,1,2,3,null]){reset({...currentDetail,commentable,statement},page([]));const d=await api.v3Article('101');assert.equal(d.articleCommentable,commentable);assert.equal(d.articleStatement,statement)}
reset(currentDetail,page([]));const missingPolicy=await api.v3Article('101');assert.equal(missingPolicy.articleCommentable,null);assert.equal(missingPolicy.articleStatement,null);
for(const policy of [{commentable:'true'},{commentable:1},{statement:'1'},{statement:4},{statement:-1}]){reset({...currentDetail,...policy},page([]));await assert.rejects(api.v3Article('101'),e=>e.status===502)}
console.log('PASS article policy strict current Boolean and declaration enum, explicit/missing unknown never becomes allowed or no declaration')
