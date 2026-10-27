import { ApiError,request } from './http'
export type OwnerOperation='delete'|'stick'
export type OwnerCommand={kind:OwnerOperation;id:string;key:string}
export type OwnerReceipt={kind:OwnerOperation;id:string;paidPoints?:number;stuckAt?:number}
function id(value:string){if(typeof value!=='string'||!/^[1-9][0-9]{0,18}$/.test(value))throw new ApiError('文章ID不合法',422);return value}
function row(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError('文章管理响应不正确',502);return value as Record<string,unknown>}
function data(value:unknown){const r=row(value);if(r.code!==0)throw new ApiError('文章管理响应不正确',502);return row(r.data)}
/** Existing private source route proves ownership; retain only metadata, never the original body. */
export async function articleOwnerProof(target:string,signal?:AbortSignal):Promise<{id:string;status:number}>{
 const r=data(await request(`/api/v3/me/articles/${id(target)}/source`,{signal,cache:'no-store'}))
 if(r.id!==target||typeof r.status!=='number'||!Number.isSafeInteger(r.status)||r.status<0)throw new ApiError('本人文章信息不正确',502)
 return{id:target,status:r.status}
}
export async function writeArticleOwner(command:OwnerCommand):Promise<OwnerReceipt>{
 const target=id(command.id)
 if(!['delete','stick'].includes(command.kind)||typeof command.key!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(command.key))throw new ApiError('文章操作不合法',422)
 const r=data(await request(`/api/v3/articles/${target}${command.kind==='stick'?'/stick':''}`,{method:command.kind==='stick'?'POST':'DELETE',headers:{'Idempotency-Key':command.key},...(command.kind==='stick'?{body:'{}'}:{})}))
 if(r.id!==target)throw new ApiError('文章操作回执不正确',502)
 if(command.kind==='delete')return{kind:'delete',id:target}
 if(typeof r.paidPoints!=='number'||!Number.isSafeInteger(r.paidPoints)||r.paidPoints<=0||r.paidPoints>2147483647||typeof r.stuckAt!=='number'||!Number.isSafeInteger(r.stuckAt)||r.stuckAt<=0)throw new ApiError('置顶回执不正确',502)
 return{kind:'stick',id:target,paidPoints:r.paidPoints,stuckAt:r.stuckAt}
}
