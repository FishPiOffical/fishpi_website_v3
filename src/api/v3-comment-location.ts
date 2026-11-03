import { ApiError, request } from './http'
export interface CommentLocation { id:string; articleId:string; type:0|1; page:number; size:20; paragraph:null|{id:string;state:'active'|'orphaned'} }
const invalid=()=>new ApiError('评论位置响应不正确',502,'invalid_response')
function id(value:unknown):string {if(typeof value!=='string'||!/^\d{1,19}$/.test(value))throw invalid();return value}
export function commentLink(articleId:string,commentId:string){id(articleId);id(commentId);return `/article/${articleId}?comment=${commentId}#comment${commentId}`}
export function commentTarget(query:unknown,hash:unknown):string {
 if(query!==undefined){if(typeof query!=='string'||!/^\d{1,19}$/.test(query))throw new ApiError('评论定位参数不合法',422);return query}
 if(typeof hash!=='string')return ''
 let decoded='';try{decoded=decodeURIComponent(hash)}catch{return ''}
 return /^#(?:comment-?)?(\d{1,19})$/.exec(decoded)?.[1]||''
}
export async function fetchCommentLocation(commentId:string,articleId:string,signal?:AbortSignal):Promise<CommentLocation>{
 id(commentId);id(articleId)
 const envelope=await request<{code:number;data:unknown}>(`/api/v3/comments/${commentId}/location`,{cache:'no-store',signal})
 if(!envelope||envelope.code!==0||!envelope.data||typeof envelope.data!=='object'||Array.isArray(envelope.data))throw invalid()
 const row=envelope.data as Record<string,unknown>
 if(id(row.id)!==commentId||id(row.articleId)!==articleId||(row.type!==0&&row.type!==1)||row.size!==20||typeof row.page!=='number'||!Number.isSafeInteger(row.page)||row.page<1||row.page>Math.floor(2147483647/50))throw invalid()
 let paragraph:CommentLocation['paragraph']=null
 if(row.type===0){if(row.paragraph!==null)throw invalid()}
 else{if(!row.paragraph||typeof row.paragraph!=='object'||Array.isArray(row.paragraph))throw invalid();const p=row.paragraph as Record<string,unknown>;if(typeof p.id!=='string'||!/^[a-f0-9]{64}$/.test(p.id)||(p.state!=='active'&&p.state!=='orphaned'))throw invalid();paragraph={id:p.id,state:p.state}}
 return{id:commentId,articleId,type:row.type,page:row.page,size:20,paragraph}
}
