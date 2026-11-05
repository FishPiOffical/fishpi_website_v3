import { ApiError, request } from './http'
import { resolveV3TagId } from './v3-content'
export type ContentRelationKind='tag'|'collection'|'subscription'
export type ContentRelationState={targetId:string;following:boolean}
const paths={tag:'follows/tags',collection:'collections',subscription:'subscriptions'} as const
function path(kind:ContentRelationKind,id:string){if(!Object.hasOwn(paths,kind)||!/^[1-9][0-9]{0,18}$/.test(id))throw new ApiError('关系目标不合法',422);return `/api/v3/me/${paths[kind]}/${id}`}
function row(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError('关系响应格式不正确',502);return value as Record<string,unknown>}
export async function resolveContentRelationTarget(kind:ContentRelationKind,value:string){if(kind!=='tag'){path(kind,value);return value}const id=await resolveV3TagId(value);path(kind,id);return id}
export async function readContentRelation(kind:ContentRelationKind,id:string):Promise<ContentRelationState>{const envelope=row(await request(path(kind,id),{cache:'no-store'})),data=row(envelope.data);if(envelope.code!==0||data.targetId!==id||typeof data.following!=='boolean')throw new ApiError('关系状态响应不正确',502);return{targetId:id,following:data.following}}
export async function setContentRelation(kind:ContentRelationKind,id:string,following:boolean,key:string):Promise<void>{
  if(typeof following!=='boolean'||!/^[A-Za-z0-9._:-]{1,128}$/.test(key))throw new ApiError('关系操作参数不合法',422)
  const envelope=row(await request(path(kind,id),{method:following?'PUT':'DELETE',headers:{'Idempotency-Key':key}})),data=row(envelope.data)
  if(envelope.code!==0||data.following!==following||typeof data.changed!=='boolean')throw new ApiError('关系结果响应不正确',502)
}
