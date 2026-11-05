import { ApiError,getAuthContextVersion,request } from '../http'
import { getLegacyKey } from './auth'
import { getApiMode } from '../mode'
import { legacyObject } from './home'
import { tagPrefix,validTagPrefix } from '../v3-tag-suggestions'
let cached:{identity:string;expires:number;titles:string[]}|null=null
/** Public used-tag directory only. Never cache partial pages, private credentials or arbitrary tag metadata. */
export async function legacyTagSuggestions(value:string,signal?:AbortSignal):Promise<string[]>{
 const prefix=tagPrefix(value)
 if(!validTagPrefix(prefix))throw new ApiError('标签联想前缀不合法',422)
 const key=getLegacyKey(),context=getAuthContextVersion(),identity=String(context)
 if(getApiMode()!=='v1'||!key)throw new ApiError('请先登录使用旧版标签建议',401)
 const current=()=>{signal?.throwIfAborted();if(getApiMode()!=='v1'||key!==getLegacyKey()||context!==getAuthContextVersion())throw new ApiError('登录状态已变化',409)}
 current()
 let titles:string[]
 if(cached&&cached.identity===identity&&cached.expires>Date.now())titles=cached.titles
 else{
  cached=null;titles=[];let total:number|undefined,pages=1;const seen=new Set<string>(),uris=new Set<string>()
  for(let p=1;p<=pages;p++){
   current();const raw=legacyObject(await request(`/api/tags?p=${p}&size=100`,{signal,cache:'no-store',redirect:'error'}));current()
   if(raw.code!==0)throw new ApiError('旧版标签目录读取失败，可继续手动输入',502)
   const data=legacyObject(raw.data),pagination=legacyObject(data.pagination),count=data.total,pageCount=pagination.paginationPageCount
   if(typeof count!=='number'||!Number.isSafeInteger(count)||count<0||count>10000||typeof pageCount!=='number'||pageCount!==Math.ceil(count/100)||total!==undefined&&total!==count||!Array.isArray(data.tags)||data.tags.length!==Math.max(0,Math.min(100,count-(p-1)*100)))throw new ApiError('旧版标签目录不完整，可继续手动输入',502)
   if(p===1){total=count;pages=pageCount}
   for(const value of data.tags){const row=legacyObject(value),title=row.tagTitle,uri=row.tagURI
    if(typeof title!=='string'||!title||title.length>255||typeof uri!=='string'||!uri||uri.length>256||uris.has(uri)||typeof row.tagReferenceCount!=='number'||!Number.isSafeInteger(row.tagReferenceCount)||row.tagReferenceCount<1)throw new ApiError('旧版标签目录响应不正确',502)
    uris.add(uri)
    // Some historical directory titles cannot be inserted by the current tag grammar.
    if(!/^[\u4e00-\u9fa5A-Za-z0-9_&#+.\-]+$/u.test(title))continue
    const normalized=title.toLowerCase();if(!seen.has(normalized)){seen.add(normalized);titles.push(title)}
   }
  }
  current();cached={identity,expires:Date.now()+60000,titles}
 }
 current();return titles.filter(title=>title.toLowerCase().startsWith(prefix.toLowerCase())).slice(0,7)
}
if(import.meta.hot)import.meta.hot.dispose(()=>{cached=null})
