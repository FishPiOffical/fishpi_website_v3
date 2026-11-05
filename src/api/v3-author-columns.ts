import { ApiError, request } from './http'
export type AuthorColumn={id:string;title:string;articleCount:number}
export type AuthorColumnPage={list:AuthorColumn[];pagination:{p:number;size:number;total:number;pageCount:number}}
const invalid=()=>new ApiError('本人专栏响应不正确',502)
function row(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw invalid();return v as Record<string,unknown>}
function integer(v:unknown,min=0){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min)throw invalid();return v}
export async function authorColumns(p=1,signal?:AbortSignal):Promise<AuthorColumnPage>{
  if(!Number.isSafeInteger(p)||p<1||p>42949672)throw new ApiError('专栏页码不合法',422)
  const r=row(await request(`/api/v3/me/columns?p=${p}&size=20`,{signal,cache:'no-store'}))
  if(r.code!==0)throw invalid()
  const data=row(r.data),meta=row(data.pagination),total=integer(meta.total),pageCount=integer(meta.pageCount)
  if(meta.p!==p||meta.size!==20||pageCount!==Math.ceil(total/20)||!Array.isArray(data.list)||data.list.length!==Math.max(0,Math.min(20,total-(p-1)*20)))throw invalid()
  const seen=new Set<string>()
  const list=data.list.map(v=>{const c=row(v);if(typeof c.id!=='string'||!/^[1-9][0-9]{0,18}$/.test(c.id)||seen.has(c.id)||typeof c.title!=='string'||c.title.length>65536)throw invalid();seen.add(c.id);return{id:c.id,title:c.title,articleCount:integer(c.articleCount)}})
  return{list,pagination:{p,size:20,total,pageCount}}
}
