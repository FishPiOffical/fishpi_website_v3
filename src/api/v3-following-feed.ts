import { ApiError, request } from './http'
import { adaptV3Article, decodeV3ContentPage } from './v3-content'
import { relationUserName } from './v3-user-relations'
import { decodeBreezemoonSummary, type BreezemoonSummary } from './v3-breezemoon-data'
import type { ArticleSummary } from './fishpi'
export type FollowingSource = 'tags' | 'users' | 'breezemoons'
export type FollowingMoon = BreezemoonSummary
export type FollowingFeedPage = { p:number; size:number; total:number; pageCount:number } & ({ source:'breezemoons'; list:FollowingMoon[] } | { source:'tags'|'users'; list:ArticleSummary[] })
const invalid=()=>new ApiError('关注动态响应格式不正确',502,'invalid_response')
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw invalid();return value as Record<string,unknown>}
function id(value:unknown):string{if(typeof value!=='string'||!/^[1-9][0-9]{0,18}$/.test(value))throw invalid();return value}
export async function fetchV3FollowingFeed(userName:string,source:FollowingSource,p=1,size=20):Promise<FollowingFeedPage>{
  if(!relationUserName(userName)||!['tags','users','breezemoons'].includes(source)||!Number.isSafeInteger(p)||p<1||p>42949672||!Number.isSafeInteger(size)||size<1||size>50)throw new ApiError('关注动态参数不合法',422)
  const path=source==='breezemoons'?`/api/v3/me/watching/breezemoons?p=${p}&size=${size}`:`/api/v3/users/${encodeURIComponent(userName)}/watching?p=${p}&size=${size}&source=${source}`
  const envelope=object(await request(path,{cache:'no-store'}));if(envelope.code!==0)throw invalid()
  const page=decodeV3ContentPage(envelope.data),meta=page.pagination
  if(meta.p!==p||meta.size!==size)throw invalid()
  const seen=new Set<string>();for(const row of page.list){const key=id(row.id);if(seen.has(key))throw invalid();seen.add(key)}
  if(source==='breezemoons')return {...meta,source,list:page.list.map(decodeBreezemoonSummary)}
  return {...meta,source,list:page.list.map(adaptV3Article)}
}
