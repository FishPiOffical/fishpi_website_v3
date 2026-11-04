import {getApiMode} from './mode'
import {ApiError,request} from './http'
export type NavigationChapter={id:string;title:string;chapterNo:number;createdAt:number}
export type ArticleColumnContext={articleId:string;column:{id:string;title:string;articleCount:number}|null;chapterNo:number|null;previous:NavigationChapter|null;next:NavigationChapter|null}
const invalid=()=>new ApiError('章节导航响应不正确',502)
function row(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw invalid();return v as Record<string,unknown>}
function text(v:unknown,max=65536){if(typeof v!=='string'||v.length>max)throw invalid();return v}
function id(v:unknown){const s=text(v,19);if(!/^[1-9][0-9]{0,18}$/.test(s))throw invalid();return s}
function integer(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)throw invalid();return v}
function chapter(v:unknown):NavigationChapter|null{if(v===null)return null;const r=row(v),target=id(r.id);if(r.permalink!==`/article/${target}`)throw invalid();return{id:target,title:text(r.title),chapterNo:integer(r.chapterNo,1,2147483647),createdAt:integer(r.createdAt,0,8640000000000000)}}
export async function fetchArticleColumn(articleId:string,signal?:AbortSignal):Promise<ArticleColumnContext>{
 if(getApiMode()==='v1')return (await import('./legacy/long-reading')).legacyArticleNavigation(articleId,signal)
 id(articleId);const envelope=row(await request(`/api/v3/articles/${articleId}/column`,{cache:'no-store',signal}));if(envelope.code!==0)throw invalid();const r=row(envelope.data);if(r.articleId!==articleId)throw invalid()
 if(r.column===null){if(r.chapterNo!==null||r.previous!==null||r.next!==null)throw invalid();return{articleId,column:null,chapterNo:null,previous:null,next:null}}
 const c=row(r.column),column={id:id(c.id),title:text(c.title),articleCount:integer(c.articleCount,1)},chapterNo=integer(r.chapterNo,1,2147483647),previous=chapter(r.previous),next=chapter(r.next)
 if(previous&&(previous.id===articleId||previous.chapterNo>chapterNo)||next&&(next.id===articleId||next.chapterNo<chapterNo)||previous&&next&&previous.id===next.id||column.articleCount===1&&(previous||next))throw invalid()
 return{articleId,column,chapterNo,previous,next}
}
