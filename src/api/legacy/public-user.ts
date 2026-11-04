import { ApiError, request } from '../http'
import { decodePublicUser, publicUserName, type PublicUser } from '../v3-public-user'
import { getLegacyKey } from './auth'
export async function legacyPublicUser(name:string):Promise<PublicUser> {
  publicUserName(name)
  const key=getLegacyKey()
  const value=await request<Record<string,unknown>>(`/user/${encodeURIComponent(name)}${key?'?'+new URLSearchParams({apiKey:key}):''}`,{cache:'no-store'})
  if(value.code!==undefined && value.code!==0)throw new ApiError(typeof value.msg==='string'?value.msg:'用户资料读取失败',404)
  // Only the six public fields enter the app, never the full legacy user payload.
  return decodePublicUser({id:value.oId,userName:value.userName,userNickname:value.userNickname,userAvatarURL:value.userAvatarURL,userIntro:value.userIntro,userURL:value.userURL},name)
}
