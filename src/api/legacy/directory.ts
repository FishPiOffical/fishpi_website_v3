import { ApiError } from '../http'
import { legacyGet, legacyObject } from './home'
import type { DirectoryKind, DirectoryPage } from '../v3-directory'
import type { DomainItem, TagItem } from '../fishpi'
function text(value:unknown) {if(typeof value!=='string'||value.length>65536)throw new ApiError('旧目录字段不正确',502);return value}
function count(value:unknown) {if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new ApiError('旧目录计数不正确',502);return value}
function icon(value:unknown) {
  const raw=text(value)
  if(/[\\\u0000-\u0020\u007f]/.test(raw))return ''
  try{const u=new URL(raw);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?raw:''}catch{return raw.startsWith('/')&&!raw.startsWith('//')?raw:''}
}
export function projectLegacyDirectoryItem(kind:DirectoryKind,value:unknown):DomainItem|TagItem {
  const r=legacyObject(value)
  if(kind==='domains') {
    const uri=text(r.domainURI ?? r.uri)
    if(!uri || uri.length>256)throw new ApiError('旧领域地址无效',502)
    return {uri,domainURI:uri,domainTitle:text(r.domainTitle),domainDescription:text(r.domainDescription),domainIconPath:icon(r.domainIconPath),
      ...((r.articleCnt ?? r.domainArticleCount)===undefined?{}:{domainArticleCount:count(r.articleCnt ?? r.domainArticleCount)})}
  }
  const uri=text(r.tagURI)
  if(!uri||uri.length>256)throw new ApiError('旧标签地址无效',502)
  return {tagURI:uri,tagTitle:text(r.tagTitle),tagDescription:text(r.tagDescription),tagIconPath:icon(r.tagIconPath),tagReferenceCount:count(r.tagReferenceCount)}
}
export function decodeLegacyDirectoryPage(value:unknown,kind:DirectoryKind,p:number):DirectoryPage {
  const r=legacyObject(value)
  if(r.kind!==kind||r.p!==p||r.size!==50||!Array.isArray(r.list)||r.list.length>50)throw new ApiError('旧目录分页不正确',502)
  const total=count(r.total),pageCount=count(r.pageCount)
  if(pageCount!==Math.ceil(total/50)||r.list.length!==Math.max(0,Math.min(50,total-(p-1)*50)))throw new ApiError('旧目录数量不一致',502)
  const list=r.list.map(x=>projectLegacyDirectoryItem(kind,x)),ids=list.map(x=>'uri'in x?x.uri:x.tagURI)
  if(new Set(ids).size!==ids.length)throw new ApiError('旧目录存在重复地址',502)
  return {kind,p,size:50,total,pageCount,list}
}
export async function legacyDirectory(kind:DirectoryKind,p:number):Promise<DirectoryPage> {
  const d=legacyObject(await legacyGet(kind==='domains'?'/api/domains':`/api/tags?p=${p}&size=50`))
  const source=d[kind]
  if(!Array.isArray(source)||source.length>10000)throw new ApiError('旧目录响应不正确',502)
  if(kind==='domains') return decodeLegacyDirectoryPage({kind,p,size:50,total:source.length,pageCount:Math.ceil(source.length/50),list:source.slice((p-1)*50,p*50)},kind,p)
  const total=count(d.total),pageCount=count(legacyObject(d.pagination).paginationPageCount)
  return decodeLegacyDirectoryPage({kind,p,size:50,total,pageCount,list:source},kind,p)
}
