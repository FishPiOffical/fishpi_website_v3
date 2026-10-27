import {ApiError,request} from './http'
export async function articleHeat(id:string,signal?:AbortSignal):Promise<number>{
 if(!/^[0-9]{1,32}$/.test(id))throw new ApiError('文章ID不合法',422)
 const value=await request<{code:number;data?:{articleId?:unknown;heat?:unknown}}>(`/api/v3/articles/${id}/heat`,{signal,cache:'no-store'})
 const data=value?.data
 if(value?.code!==0||data?.articleId!==id||typeof data.heat!=='number'||!Number.isSafeInteger(data.heat)||data.heat<0)throw new ApiError('文章热度响应不正确',502)
 return data.heat
}
