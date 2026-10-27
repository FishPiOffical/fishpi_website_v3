import { ApiError, request } from './http'
export type UserSuggestion={id:string;userName:string;userNickname:string;userAvatarURL:string}
const invalid=()=>new ApiError('用户联想响应不正确',502)
export async function userSuggestions(prefix:string,signal?:AbortSignal):Promise<UserSuggestion[]> {
  if(prefix==='')return []
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(prefix))throw new ApiError('用户名联想前缀不合法',422)
  const raw=await request<unknown>(`/api/v3/suggestions/users?prefix=${encodeURIComponent(prefix)}`,{signal,cache:'no-store'})
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw invalid()
  const r=raw as Record<string,unknown>,data=r.data as Record<string,unknown>|null
  if(r.code!==0||!data||typeof data!=='object'||!Array.isArray(data.list)||data.list.length>10)throw invalid()
  const seen=new Set<string>()
  return data.list.map(value=>{
    if(!value||typeof value!=='object'||Array.isArray(value))throw invalid()
    const row=value as Record<string,unknown>,{id,userName,userNickname,userAvatarURL}=row
    if(typeof id!=='string'||!/^[1-9][0-9]{0,18}$/.test(id)||seen.has(id)||typeof userName!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(userName)||!userName.toLowerCase().startsWith(prefix.toLowerCase())||typeof userNickname!=='string'||userNickname.length>255||typeof userAvatarURL!=='string'||userAvatarURL.length>2048)throw invalid()
    seen.add(id)
    let avatar=''
    if(userAvatarURL&&!/[\u0000-\u0020\u007f<>\\]/u.test(userAvatarURL)&&!userAvatarURL.startsWith('//'))try{const u=new URL(userAvatarURL,'https://fishpi.cn');if(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password)avatar=userAvatarURL}catch{/* display without unsafe legacy avatar */}
    return{id,userName,userNickname,userAvatarURL:avatar}
  })
}
