import { ApiError, request } from '../http'
import { adaptV3Article } from '../v3-content'
import { decodePublicColumnCard } from '../v3-public-columns'
import type { HomeData, HomeRead } from '../v3-home-reads'
type Row=Record<string,unknown>
function object(x:unknown):Row {if(!x || typeof x!=='object' || Array.isArray(x)) throw new ApiError('v1响应格式不正确',502);return x as Row}
function date(value:unknown):number {
  if(typeof value==='number' && Number.isSafeInteger(value) && value>=0) return value
  if(typeof value!=='string') throw new ApiError('v1时间字段缺失',502)
  const raw=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)?value.replace(' ','T')+'+08:00':value
  const n=Date.parse(raw);if(!Number.isFinite(n)) throw new ApiError('v1时间字段无效',502);return n
}
async function get(path:string) {
  const envelope=await request<{code:number;msg?:string;data?:unknown}>(path,{cache:'no-store'})
  if(envelope.code!==0) throw new ApiError(envelope.msg || 'v1读取失败',400)
  return envelope.data
}
export async function legacyHomeRead<K extends HomeRead>(key:K):Promise<HomeData[K]> {
  if(key==='recent' || key==='hot') {
    const data=object(await get(key==='recent'?'/api/articles/recent?p=1&size=40':'/api/articles/recent/hot?p=1&size=12'))
    if(!Array.isArray(data.articles)) throw new ApiError('v1文章列表格式不正确',502)
    return data.articles.map(x=>{
      const r=object(x),anonymous=r.articleAnonymous===1
      if(r.articleAnonymous!==0 && !anonymous) throw new ApiError('v1匿名标记无效',502)
      const author=r.articleAuthor && typeof r.articleAuthor==='object'?object(r.articleAuthor):{}
      return adaptV3Article({id:r.oId,title:r.articleTitle,type:r.articleType,tags:r.articleTags,preview:r.articlePreviewContent,
        anonymous,createdAt:date(r.articleCreateTimeStr),viewCount:r.articleViewCount,commentCount:r.articleCommentCount,
        perfect:r.articlePerfect===1,author:anonymous?{}:{id:r.articleAuthorId,userName:r.articleAuthorName,userNickname:typeof author.userNickname==='string'?author.userNickname:'',userAvatarURL:r.articleAuthorThumbnailURL48}})
    }) as HomeData[K]
  }
  if(key==='tags') {
    const data=object(await get('/api/tags?p=1&size=24'))
    if(!Array.isArray(data.tags)) throw new ApiError('v1标签格式不正确',502)
    return data.tags.map(x=>{const r=object(x);return {tagURI:r.tagURI,tagTitle:r.tagTitle,tagDescription:r.tagDescription,tagIconPath:r.tagIconPath,tagReferenceCount:r.tagReferenceCount}}) as HomeData[K]
  }
  const data=await get(`/api/columns/${key==='columnsRecent'?'latest':'hot'}?size=8`)
  if(!Array.isArray(data)) throw new ApiError('v1专栏格式不正确',502)
  return data.map(x=>{
    const r=object(x)
    const chapters=(Array.isArray(r.chapters)?r.chapters:[r.latestChapter,r.secondLatestChapter].filter(Boolean)).map(x=>{
      const c=object(x);return {id:c.articleId,title:c.articleTitle,chapterNo:c.chapterNo,createdAt:date(c.articleCreateTime),...(typeof c.articlePreviewContent==='string'?{preview:c.articlePreviewContent}:{})}
    })
    return decodePublicColumnCard({id:r.columnId,title:r.columnTitle,coverURL:r.columnCoverURL,articleCount:r.columnArticleCount,updatedAt:date(r.columnUpdateTime),chapters})
  }) as HomeData[K]
}
