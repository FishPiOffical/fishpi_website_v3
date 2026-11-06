import { ApiError, request } from './http'
export type RevisionKind='article'|'comment'
export type RevisionMeta={id:string;time:number|null;index:number;current:boolean}
export type RevisionPage={items:RevisionMeta[];pagination:{page:number;size:number;total:number;pageCount:number}}
export type RevisionDetail=RevisionMeta&{title?:string;content:string}
const invalid=()=>new ApiError('历史版本响应不正确',502)
function row(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw invalid();return v as Record<string,unknown>}
function integer(v:unknown,min=0){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min)throw invalid();return v}
function data(raw:unknown){const r=row(raw);if(r.code!==0)throw invalid();return row(r.data)}
function id(v:unknown){return typeof v==='string'&&/^[1-9][0-9]{0,18}$/.test(v)}
function path(kind:RevisionKind,target:string){if(!['article','comment'].includes(kind)||!id(target))throw new ApiError('历史目标不合法',422);return `/api/v3/${kind}s/${target}/revisions`}
function metadata(v:unknown,kind:RevisionKind):RevisionMeta{
  const r=row(v);if(!id(r.id)&&r.id!=='current'||typeof r.current!=='boolean'||r.current!==(r.id==='current'))throw invalid()
  const time=r.time===null&&kind==='comment'&&r.current?null:integer(r.time)
  return{id:r.id as string,time,index:integer(r.index,1),current:r.current}
}
export async function revisionPage(kind:RevisionKind,target:string,page=1):Promise<RevisionPage>{
  if(!Number.isSafeInteger(page)||page<1||page>Math.floor(2147483647/50))throw new ApiError('历史页码不合法',422)
  const r=data(await request(`${path(kind,target)}?p=${page}&size=20`,{cache:'no-store'})),p=row(r.pagination)
  const pagination={page:integer(p.page,1),size:integer(p.size,1),total:integer(p.total),pageCount:integer(p.pageCount)}
  const expected=Math.max(0,Math.min(20,pagination.total-(page-1)*20))
  if(pagination.page!==page||pagination.size!==20||pagination.pageCount!==Math.ceil(pagination.total/20)||!Array.isArray(r.items)||r.items.length!==expected)throw invalid()
  const seen=new Set<string>();const items=r.items.map((v,i)=>{const m=metadata(v,kind);if(seen.has(m.id)||m.index!==(page-1)*20+i+1||m.current&&m.index!==pagination.total)throw invalid();seen.add(m.id);return m})
  return{items,pagination}
}
export async function revisionDetail(kind:RevisionKind,target:string,meta:RevisionMeta):Promise<RevisionDetail>{
  const expected=metadata(meta,kind),r=data(await request(`${path(kind,target)}/${expected.id}`,{cache:'no-store'})),actual=metadata(r,kind)
  if(actual.id!==expected.id||actual.index!==expected.index||actual.current!==expected.current||actual.time!==expected.time)throw new ApiError('历史列表已变化，请重新读取列表',409)
  if(typeof r.content!=='string'||r.content.length>2097152||kind==='article'&&(typeof r.title!=='string'||r.title.length>65536))throw invalid()
  return{...actual,content:r.content,...(kind==='article'?{title:r.title as string}:{})}
}
