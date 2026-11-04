import { ApiError } from '../http'
import { legacyGet, legacyObject, legacyDate } from './home'
import { publicColumnId, type PublicColumn, type PublicChapter, type ColumnChapterPage } from '../v3-public-columns'
function count(value:unknown) {if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0) throw new ApiError('旧专栏计数无效',502);return value}
function text(value:unknown) {if(typeof value!=='string') throw new ApiError('旧专栏字段无效',502);return value}
export async function legacyColumnPage(id:string,p=1):Promise<ColumnChapterPage> {
  publicColumnId(id)
  if(!Number.isSafeInteger(p)||p<1||p>1000000) throw new ApiError('章节页码无效',422)
  const d=legacyObject(await legacyGet(`/api/columns/${encodeURIComponent(id)}/articles?p=${p}&size=20`)),pagination=legacyObject(d.pagination)
  if(!Array.isArray(d.articles)||d.articles.length>20) throw new ApiError('旧专栏章节响应无效',502)
  const total=count(pagination.paginationRecordCount),pageCount=count(pagination.paginationPageCount)
  const list=d.articles.map((item):PublicChapter=>{
    const r=legacyObject(item),articleId=text(r.articleId)
    if(!/^[1-9][0-9]{0,31}$/.test(articleId)) throw new ApiError('旧专栏章节ID无效',502)
    return {id:articleId,title:text(r.articleTitle),chapterNo:count(r.chapterNo),createdAt:legacyDate(r.articleCreateTime)}
  })
  if(new Set(list.map(x=>x.id)).size!==list.length || list.length!==Math.max(0,Math.min(20,total-(p-1)*20)) || pageCount!==Math.ceil(total/20) && !(total===0 && pageCount===1)) throw new ApiError('旧专栏目录与分页不一致',502)
  return {list,p,size:20,total,pageCount}
}
export async function legacyColumnDetail(id:string) {
  publicColumnId(id)
  const d=legacyObject(await legacyGet(`/api/columns/${encodeURIComponent(id)}`))
  if(d.columnId!==id) throw new ApiError('旧专栏目标不匹配',502)
  const total=count(d.columnArticleCount),firstPage=await legacyColumnPage(id,1)
  if(firstPage.total!==total) throw new ApiError('旧接口章节目录与专栏章节数不一致，请稍后重试',503)
  const all=[...firstPage.list]
  if(firstPage.pageCount>500) throw new ApiError('专栏目录过大，请稍后重试',503)
  for(let p=2;p<=firstPage.pageCount;p++) {
    const next=await legacyColumnPage(id,p)
    if(next.total!==total || next.pageCount!==firstPage.pageCount) throw new ApiError('章节目录发生变化，请重试',409)
    all.push(...next.list)
  }
  if(all.length!==total || new Set(all.map(x=>x.id)).size!==all.length) throw new ApiError('旧章节目录不完整',502)
  all.sort((a,b)=>a.chapterNo-b.chapterNo || a.createdAt-b.createdAt)
  const first=all[0],latest=all.at(-1)
  if(!first || !latest) throw new ApiError('该专栏当前没有可读取章节',404)
  const column:PublicColumn={id,title:text(d.columnTitle),coverURL:typeof d.columnCoverURL==='string'?d.columnCoverURL:'',articleCount:total,updatedAt:typeof d.columnUpdateTime==='number'?legacyDate(d.columnUpdateTime):latest.createdAt,chapters:latest?[latest]:[]}
  return {column,first,latest}
}
