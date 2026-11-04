import {ApiError,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject} from './home'
import type {ReactionTarget,ReactionState,ReactionOption} from '../v3-reactions'
export type LegacyReactionSource={articleId?:string;page?:number;paragraphId?:string;sort?:string}
// Classic Reaction.java protocol constants. Never used as a v3 catalog fallback.
export const LEGACY_REACTION_OPTIONS: ReactionOption[] = [
  { value: 'thumbsup', emoji: '👍' },
  { value: 'plus', emoji: '➕1️⃣' },
  { value: 'thumbsdown', emoji: '👎' },
  { value: 'check', emoji: '✅' },
  { value: 'cross', emoji: '❌' },
  { value: 'star', emoji: '⭐' },
  { value: 'heart', emoji: '❤️' },
  { value: 'fire', emoji: '🔥' },
  { value: 'party', emoji: '🎉' },
  { value: 'laugh', emoji: '😂' },
  { value: 'wow', emoji: '😮' },
  { value: 'clap', emoji: '👏' },
  { value: 'eyes', emoji: '👀' },
  { value: 'thinking', emoji: '🤔' },
  { value: 'cry', emoji: '😢' },
  { value: 'angry', emoji: '😡' },
  { value: 'brokenheart', emoji: '💔' },
  { value: 'heartonfire', emoji: '❤️‍🔥' },
  { value: 'hundred', emoji: '💯' },
  { value: 'rocket', emoji: '🚀' },
  { value: 'salute', emoji: '🖖' },
  { value: 'handshake', emoji: '🤝' },
  { value: 'raisedhands', emoji: '🙌' },
  { value: 'mindblown', emoji: '🤯' },
  { value: 'pray', emoji: '🙏' },
  { value: 'skull', emoji: '💀' },
  { value: 'clown', emoji: '🤡' },
  { value: 'poop', emoji: '💩' },
]
export function legacyReactionTarget(kind:ReactionTarget,id:string){if(!['article','comment','chat'].includes(kind)||typeof id!=='string'||!/^[1-9][0-9]{0,31}$/.test(id))throw new ApiError('表态目标不合法',422);return{kind,id}}
function fail(){return new ApiError('旧表态状态缺失或格式不正确',502)}
export function decodeLegacyReactions(raw:unknown,kind:ReactionTarget,id:string):ReactionState{
 legacyReactionTarget(kind,id);const r=legacyObject(raw),catalog=new Map(LEGACY_REACTION_OPTIONS.map(v=>[v.value,v.emoji]))
 if(r.oId!==id||typeof r.currentUserReaction!=='string'||r.currentUserReaction!==''&&!catalog.has(r.currentUserReaction)||!Array.isArray(r.reactionSummary)||r.reactionSummary.length>catalog.size)throw fail()
 const current=r.currentUserReaction,seen=new Set<string>(),summary=r.reactionSummary.map(value=>{const item=legacyObject(value);if(typeof item.value!=='string'||!catalog.has(item.value)||seen.has(item.value)||!Number.isSafeInteger(item.count)||Number(item.count)<1||typeof item.selected!=='boolean'||item.selected!==(current===item.value)||!Array.isArray(item.users)||item.users.length>10000||item.users.some(u=>typeof u!=='string'||!u||u.length>1024||/[\u0000-\u001f\u007f-\u009f]/u.test(u)))throw fail();seen.add(item.value);return{value:item.value,emoji:catalog.get(item.value)!,count:item.count as number,selected:item.value===current,users:item.users as string[]}})
 if(current&&!seen.has(current))throw fail();return{targetId:id,targetType:kind,currentUserReaction:current,summary}
}
function envelope(raw:unknown){const r=legacyObject(raw);if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'表态读取失败',400);return r}
/** Coalesce only simultaneous reads; never retain a private resource or stale snapshot. */
export function createLegacyReactionReader(){
 const flights=new Map<string,Promise<Record<string,unknown>>>()
 async function read(path:string,body?:Record<string,unknown>){const key=getLegacyKey(),payload=body?{...body,...(key?{apiKey:key}:{})}:undefined,url=body?path:path+(path.includes('?')?'&':'?')+new URLSearchParams(key?{apiKey:key}:{}),identity=JSON.stringify([url,payload]);let task=flights.get(identity);if(!task){task=request(url,{cache:'no-store',...(payload?{method:'POST',body:JSON.stringify(payload)}:{})}).then(envelope);flights.set(identity,task)}try{return await task}finally{if(flights.get(identity)===task)flights.delete(identity)}}
 async function current(kind:ReactionTarget,id:string,source:LegacyReactionSource={}){
  legacyReactionTarget(kind,id)
  if(kind==='chat'){if(!getLegacyKey())throw new ApiError('请先登录聊天室',401);const r=await read('/chat-room/getMessage?'+new URLSearchParams({oId:id,mode:'0',size:'0',type:'html'}));if(!Array.isArray(r.data)||r.data.length!==1)throw new ApiError('当前消息不可读取',404);return decodeLegacyReactions(r.data[0],kind,id)}
  if(kind==='article'){const r=await read(`/api/article/${id}?p=1`);return decodeLegacyReactions(legacyObject(r.data).article,kind,id)}
  const articleId=source.articleId||'',page=source.page??1;legacyReactionTarget('article',articleId);if(!Number.isSafeInteger(page)||page<1||page>1000000)throw new ApiError('评论页码不合法',422)
  let rows:unknown,niceRows:unknown
  if(source.paragraphId){if(source.paragraphId.length>256||/[\u0000-\u001f\u007f]/u.test(source.paragraphId)||source.sort&&!['hot'].includes(source.sort))throw new ApiError('段评位置不合法',422);const r=await read('/comment/paragraph/thread/parents',{articleId,paragraphId:source.paragraphId,paginationCurrentPageNum:page,userCommentViewMode:0,sort:source.sort||''});if(r.paragraphId!==source.paragraphId)throw fail();rows=r.commentThreadParents}
  else{const r=await read(`/api/article/${articleId}?p=${page}`),article=legacyObject(legacyObject(r.data).article);if(article.oId!==articleId)throw fail();rows=article.articleComments;niceRows=article.articleNiceComments}
  let budget=0;const found:Record<string,unknown>[]=[];function scan(list:unknown,depth=0){if(!Array.isArray(list)||depth>20)throw fail();for(const v of list){if(++budget>5000)throw fail();const r=legacyObject(v);if(r.oId===id)found.push(r);if(r.commentThreadReplies!==undefined)scan(r.commentThreadReplies,depth+1)}}scan(rows);if(!found.length&&niceRows!==undefined)scan(niceRows)
  if(found.length>1)throw fail();if(found.length===1)return decodeLegacyReactions(found[0],kind,id)
  // The reply endpoint resolves its thread root and locates this exact reply by anchor.
  const r=await read('/comment/thread/replies',{commentId:id,anchorCommentId:id,paginationCurrentPageNum:1});if(!Array.isArray(r.commentThreadReplies)||r.commentThreadReplies.length>100)throw fail();const matches=r.commentThreadReplies.filter(v=>legacyObject(v).oId===id);if(matches.length!==1)throw new ApiError('当前评论不在可读取的列表中',404);return decodeLegacyReactions(matches[0],kind,id)
 }
 return{current,clear:()=>flights.clear()}
}
/** One click is exactly one classic toggle. There is no same-key replay contract. */
export async function legacyToggleReaction(kind:ReactionTarget,id:string,value:string){legacyReactionTarget(kind,id);if(!LEGACY_REACTION_OPTIONS.some(v=>v.value===value))throw new ApiError('请选择有效表情',422);const apiKey=getLegacyKey();if(!apiKey)throw new ApiError('请先登录后表态',401);const r=envelope(await request(kind==='chat'?'/chat-room/reaction':`/${kind}/reaction`,{method:'POST',__captchaRetried:true,body:JSON.stringify({apiKey,[kind==='chat'?'oId':kind+'Id']:id,groupType:'emoji',value})}));const data=legacyObject(r.data);if(data.targetId!==id||data.targetType!==kind||data.groupType!=='emoji')throw fail()}
