import { ApiError, request } from '../http'
import { getLegacyKey } from './auth'
import { legacyObject } from './home'
import { emptyPost, postId, postInput, type PostFields } from '../v3-posts'
export type LegacyDraft = { id:string; title:string; summary:string; updatedAt:number; createdAt:number }
export type LegacyPostCommand = { op:'publish'|'draft-save'|'draft-delete'; id:string; input:Record<string,unknown> }
export type LegacyPostReceipt = { id:string; op:LegacyPostCommand['op']; warning:string }
const bad=()=>new ApiError('旧文章或草稿响应格式不正确',502)
function id(v:unknown):string { if(!postId(v))throw bad();return v }
function text(v:unknown,max:number){if(typeof v!=='string'||v.length>max||v.includes('\0'))throw bad();for(let i=0;i<v.length;i++){const c=v.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const n=v.charCodeAt(++i);if(!(n>=0xdc00&&n<=0xdfff))throw bad()}else if(c>=0xdc00&&c<=0xdfff)throw bad()}return v}
function num(v:unknown,max=Number.MAX_SAFE_INTEGER){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>max)throw bad();return v}
function bool(v:unknown){if(typeof v!=='boolean')throw bad();return v}
function summary(raw:unknown,owner:string):LegacyDraft {const r=legacyObject(raw);if(r.articleDraftUserId!==owner)throw bad();return{id:id(r.oId),title:text(r.articleDraftTitle,255),summary:text(r.articleDraftSummary,160),createdAt:num(r.articleDraftCreatedTime),updatedAt:num(r.articleDraftUpdatedTime)}}
async function read(path:string){const key=getLegacyKey();if(!key)throw new ApiError('请先登录查看本人草稿',401);const r=legacyObject(await request(path+'?'+new URLSearchParams({apiKey:key}),{cache:'no-store'}));if(key!==getLegacyKey())throw new ApiError('登录状态已变化',409);if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'草稿读取失败',400);return legacyObject(r.data)}
export async function legacyDraftList(owner:string):Promise<LegacyDraft[]>{id(owner);const r=await read('/api/article-drafts');if(!Array.isArray(r.drafts)||r.drafts.length>50)throw bad();const list=r.drafts.map(d=>summary(d,owner));if(new Set(list.map(d=>d.id)).size!==list.length)throw bad();return list}
export async function legacyDraftSource(target:string,owner:string):Promise<PostFields&{id:string}>{id(target);id(owner);const r=legacyObject((await read('/api/article-drafts/'+target)).draft),s=summary(r,owner);if(s.id!==target)throw bad();const type=num(r.articleDraftType,6);return{...emptyPost(),id:s.id,title:s.title,content:text(r.articleDraftContent,1024000),thoughtContent:text(r.articleDraftThoughtContent,1024000),tags:text(r.articleDraftTags,255),type,columnId:text(r.articleDraftColumnId,19),columnTitle:text(r.articleDraftColumnTitle,64),chapterNo:text(r.articleDraftChapterNo,32),rewardContent:text(r.articleDraftRewardContent,102400),rewardPoint:num(r.articleDraftRewardPoint,2147483647),qnaOfferPoint:num(r.articleDraftQnAOfferPoint,2147483647),commentable:bool(r.articleDraftCommentable),anonymous:bool(r.articleDraftAnonymous),notifyFollowers:bool(r.articleDraftNotifyFollowers),showInList:num(r.articleDraftShowInList,1),statement:num(r.articleDraftStatement,3)}}
const names:Record<string,string>={title:'articleTitle',content:'articleContent',thoughtContent:'articleDraftThoughtContent',tags:'articleTags',type:'articleType',columnId:'columnId',columnTitle:'columnTitle',chapterNo:'chapterNo',columnCoverURL:'columnCoverURL',rewardContent:'articleRewardContent',rewardPoint:'articleRewardPoint',qnaOfferPoint:'articleQnAOfferPoint',commentable:'articleCommentable',anonymous:'articleAnonymous',notifyFollowers:'articleNotifyFollowers',showInList:'articleShowInList',statement:'articleStatement',draftId:'articleDraftId'}
export function legacyPostInput(op:LegacyPostCommand['op'],fields:PostFields,draftId=''){return postInput(op,fields,null,draftId)}
export async function writeLegacyPost(command:LegacyPostCommand,owner:string):Promise<LegacyPostReceipt>{
 const {op,id:target,input}=command;id(owner);if(!['publish','draft-save','draft-delete'].includes(op)||op==='publish'&&target!==''||op==='draft-delete'&&!postId(target)||op==='draft-save'&&target!==''&&!postId(target))throw new ApiError('旧文章操作参数不正确',422)
 const key=getLegacyKey();if(!key)throw new ApiError('请先登录',401)
 let body:Record<string,unknown>={apiKey:key}
 if(op==='draft-delete'){if(Object.keys(input).length)throw new ApiError('删除参数不正确',422)}else{
  // Validate an entire frozen form; arbitrary author/status/bypass fields cannot reach Rhythm.
  const checked=legacyPostInput(op,{...emptyPost(),...input} as PostFields,op==='publish'&&typeof input.draftId==='string'?input.draftId:'')
  if(JSON.stringify(checked)!==JSON.stringify(input))throw new ApiError('旧文章操作参数不完整或含不支持字段',422)
  for(const [k,v]of Object.entries(checked)){if(!names[k])throw new ApiError('旧文章字段不支持',422);body[names[k]]=v}
  if(op==='draft-save'&&target)body.articleDraftId=target
 }
 const path=op==='publish'?'/article':op==='draft-delete'?'/api/article-drafts/'+target+'?'+new URLSearchParams({apiKey:key}):'/api/article-drafts'
 const r=legacyObject(await request(path,{method:op==='draft-delete'?'DELETE':'POST',cache:'no-store',__captchaRetried:true,...(op==='draft-delete'?{}:{body:JSON.stringify(body)})}))
 if(key!==getLegacyKey())throw new ApiError('登录状态已变化',409)
 if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'旧文章操作未确认',502)
 if(op==='publish')return{op,id:id(r.articleId),warning:typeof r.draftRemoveMsg==='string'?text(r.draftRemoveMsg,2000):''}
 const d=legacyObject(r.data)
 if(op==='draft-delete'){if(d.id!==target)throw bad();return{op,id:target,warning:''}}
 const saved=summary(d.draft,owner);if(target&&saved.id!==target)throw bad();return{op,id:saved.id,warning:''}
}
