import { md5 } from 'js-md5'
import { ApiError, request } from '../http'
import type { AccountInfo } from '../fishpi'
let key: string | null = null
export function getLegacyKey() { return key }
export function setLegacyKey(value: string | null) { key=value }
export async function legacyLogin(nameOrEmail: string, password: string, mfaCode: string) {
  const result=await request<{code:number;Key?:string;msg?:string}>('/api/getKey',{method:'POST',body:JSON.stringify({nameOrEmail,userPassword:md5(password),mfaCode})})
  if(result.code!==0 || typeof result.Key!=='string' || !result.Key) throw new ApiError(result.msg || '登录失败',401)
  return result.Key
}
export async function legacyAccount(apiKey:string):Promise<AccountInfo> {
  const result=await request<{code:number;msg?:string;data?:Record<string,unknown>}>('/api/user?'+new URLSearchParams({apiKey}),{cache:'no-store'})
  const d=result.data
  if(result.code!==0 || !d) throw new ApiError(result.msg || '登录凭据无效',401)
  if(typeof d.oId!=='string' || !d.oId || typeof d.userName!=='string') throw new ApiError('本人资料响应格式不正确',502)
  // Explicitly project fields used by the shell, never expose the raw legacy account.
  return {oId:d.oId,userName:d.userName,...(typeof d.userNickname==='string'?{userNickname:d.userNickname}:{}),...(typeof d.userAvatarURL==='string'?{userAvatarURL:d.userAvatarURL}:{}),...(typeof d.userPoint==='number'?{userPoint:d.userPoint}:{}),...(typeof d.userIntro==='string'?{userIntro:d.userIntro}:{})}
}
