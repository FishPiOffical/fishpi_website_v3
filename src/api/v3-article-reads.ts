import {ApiError,request} from './http'
/** Server-owned six-hour deduplication; no identity/window/count supplied by the browser. */
export async function registerArticleRead(articleId:string,signal?:AbortSignal):Promise<boolean>{
 if(!/^[1-9][0-9]{0,18}$/.test(articleId))throw new ApiError('文章ID不合法',422)
 const value=await request<{code:number;data?:{articleId?:unknown;recorded?:unknown}}>(`/api/v3/articles/${articleId}/reads`,{method:'POST',body:'{}',cache:'no-store',signal})
 if(value?.code!==0||value.data?.articleId!==articleId||typeof value.data.recorded!=='boolean')throw new ApiError('阅读登记响应不正确',502)
 return value.data.recorded
}
