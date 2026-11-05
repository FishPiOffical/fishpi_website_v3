import {ApiError,request} from './http'
import {getApiMode} from './mode'
export async function articleHeat(id:string,signal?:AbortSignal):Promise<number>{
 if(!/^[0-9]{1,32}$/.test(id))throw new ApiError('文章ID不合法',422)
 if(getApiMode()==='v1'){
  const value=await request<{articleHeat?:unknown}>(`/api/article/heat/${id}`,{signal,cache:'no-store',redirect:'error'})
  if(typeof value?.articleHeat!=='number'||!Number.isSafeInteger(value.articleHeat)||value.articleHeat<0)throw new ApiError('文章热度响应不正确',502)
  return value.articleHeat
 }
 const value=await request<{code:number;data?:{articleId?:unknown;heat?:unknown}}>(`/api/v3/articles/${id}/heat`,{signal,cache:'no-store'})
 const data=value?.data
 if(value?.code!==0||data?.articleId!==id||typeof data.heat!=='number'||!Number.isSafeInteger(data.heat)||data.heat<0)throw new ApiError('文章热度响应不正确',502)
 return data.heat
}
