import {ApiError,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject} from './home'
function key(){const value=getLegacyKey();if(!value)throw new ApiError('请先登录',401);return value}
export async function legacyMarkdownPreview(content:string,signal?:AbortSignal){
 const value=legacyObject(await request('/markdown',{method:'POST',body:JSON.stringify({markdownText:content}),cache:'no-store',signal}))
 if(value.code===0&&!content.trim()&&value.html===''&&value.data===undefined)return ''
 if(value.code!==0||typeof value.data!=='string')throw new ApiError(typeof value.msg==='string'?value.msg:'预览响应不正确',502)
 return value.data
}
export async function legacyUploadTicket(signal:AbortSignal){
 signal.throwIfAborted()
 const credential=key(),value=legacyObject(await request('/api/rhypic/upload-ticket?'+new URLSearchParams({apiKey:credential}),{method:'POST',signal,cache:'no-store'}))
 signal.throwIfAborted();if(getLegacyKey()!==credential)throw new ApiError('登录状态已变更',401)
 if(value.code!==0)throw new ApiError(typeof value.msg==='string'?value.msg:'上传票据读取失败',502)
 const data=legacyObject(value.data)
 if(typeof data.uploadURL!=='string'||typeof data.ticket!=='string'||!data.ticket||/\s/.test(data.ticket)||data.ticket.length>16384)throw new ApiError('上传票据格式不正确',502)
 let origin:URL
 try{origin=new URL(data.uploadURL)}catch{throw new ApiError('上传地址格式不正确',502)}
 if(origin.username||origin.password||origin.search||origin.hash||/[\u0000-\u0020\\]/.test(data.uploadURL)||!(origin.protocol==='https:'||origin.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(origin.hostname)))throw new ApiError('上传地址格式不正确',502)
 return{credential:data.ticket,uploadURL:origin.href.replace(/\/$/,'')+'/api/v1/files'}
}
export type EditorSuggestion={userName:string;userNickname:string;userAvatarURL:string}
export function legacyEditorImage(v:unknown){if(typeof v!=='string'||! /^(?:https?:\/\/|\/(?!\/))/.test(v)||v.length>4096||/[\u0000-\u0020\u007f<>\\]/.test(v)||v.startsWith('//'))return '';try{const u=new URL(v,'https://fishpi.cn');return['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?v:''}catch{return ''}}
export async function legacyUserSuggestions(prefix:string,signal?:AbortSignal):Promise<EditorSuggestion[]>{
 if(!/^[A-Za-z0-9_-]{1,64}$/.test(prefix))throw new ApiError('用户名联想前缀不合法',422)
 const credential=key(),value=legacyObject(await request('/users/names',{method:'POST',body:JSON.stringify({name:prefix,apiKey:credential}),cache:'no-store',signal}))
 if(getLegacyKey()!==credential)throw new ApiError('登录状态已变更',401)
 if(value.code!==0||!Array.isArray(value.data)||value.data.length>10000)throw new ApiError('用户联想响应不正确',502)
 const seen=new Set<string>()
 return value.data.map(v=>{const r=legacyObject(v);if(typeof r.userName!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(r.userName)||!r.userName.toLowerCase().startsWith(prefix.toLowerCase())||seen.has(r.userName.toLowerCase())||r.userNickname!==undefined&&typeof r.userNickname!=='string')throw new ApiError('用户联想响应不正确',502);seen.add(r.userName.toLowerCase());return{userName:r.userName,userNickname:typeof r.userNickname==='string'?r.userNickname:'',userAvatarURL:legacyEditorImage(r.userAvatarURL20||r.userAvatarURL)}}).slice(0,10)
}
