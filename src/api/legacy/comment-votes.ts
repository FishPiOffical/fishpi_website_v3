import {ApiError,getAuthContextVersion,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject} from './home'
import {createLegacyReactionReader,legacyReactionTarget,type LegacyReactionSource} from './reactions'
export type LegacyCommentVote={id:string;vote:'up'|'down'|null;upCount:number;downCount:number}
const bad=()=>new ApiError('旧评论投票状态不正确',502)
export function createLegacyCommentVoteReader(){
 const reader=createLegacyReactionReader()
 return{clear:reader.clear,async read(id:string,source:LegacyReactionSource):Promise<LegacyCommentVote>{
  legacyReactionTarget('comment',id);const key=getLegacyKey(),context=getAuthContextVersion()
  if(!key)throw new ApiError('请先登录查看评论投票',401)
  const value=await reader.current('comment',id,source,value=>{const row=legacyObject(value)
   if(row.oId!==id||![-1,0,1].includes(row.commentVote as number))throw bad()
   function count(v:unknown){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw bad();return v}
   return{id,vote:row.commentVote===0?'up' as const:row.commentVote===1?'down' as const:null,upCount:count(row.commentGoodCnt),downCount:count(row.commentBadCnt)}
  })
  if(key!==getLegacyKey()||context!==getAuthContextVersion())throw new ApiError('登录状态已变化',409)
  return value
 }}
}
export async function toggleLegacyCommentVote(id:string,choice:'up'|'down'){
 legacyReactionTarget('comment',id);if(!['up','down'].includes(choice))throw new ApiError('评论投票选项不合法',422)
 const key=getLegacyKey(),context=getAuthContextVersion();if(!key)throw new ApiError('请先登录后投票',401)
 const result=legacyObject(await request(`/vote/${choice}/comment`,{method:'POST',cache:'no-store',redirect:'error',__captchaRetried:true,body:JSON.stringify({apiKey:key,dataId:id})}))
 if(key!==getLegacyKey()||context!==getAuthContextVersion())throw new ApiError('登录状态已变化',409)
 if(result.code!==0)throw new ApiError(typeof result.msg==='string'?result.msg:'评论投票结果未确认',502)
 // type is the previous vote; the caller must reread current state.
}
