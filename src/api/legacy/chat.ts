import {ApiError,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject,legacyDate} from './home'
import {legacyEditorImage} from './editor'
import type {ChatLine,OnlineUser} from '@/stores/chat'
import type {ChatNodeOption} from '../fishpi'
export function legacyChatId(v:unknown):string{if(typeof v!=='string'||!/^[1-9][0-9]{0,31}$/.test(v))throw new ApiError('聊天室消息ID不正确',502);return v}
function text(v:unknown,max=262144){if(typeof v!=='string'||v.length>max)throw new ApiError('聊天室字段格式不正确',502);return v}
function userId(v:unknown){if(v===undefined)return undefined;if(typeof v==='number'){if(!Number.isSafeInteger(v)||v<=0)throw new ApiError('聊天室作者ID不正确',502);return String(v)}return legacyChatId(v)}
function name(v:unknown){const s=text(v,64);if(!/^[A-Za-z0-9_-]+$/.test(s))throw new ApiError('聊天室用户名不正确',502);return s}
function query(path:string,params:Record<string,string>,required=false){const key=getLegacyKey();if(required&&!key)throw new ApiError('请先登录聊天室',401);return path+'?'+new URLSearchParams({...params,...(key?{apiKey:key}:{})})}
async function data(path:string,signal?:AbortSignal){const r=legacyObject(await request(path,{signal,cache:'no-store'}));if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'聊天室读取失败',400);return r.data}
export function projectLegacyChat(value:unknown):ChatLine{
 const r=legacyObject(value),content=text(r.content),result:ChatLine={oId:legacyChatId(r.oId),userOId:userId(r.userOId),userName:name(r.userName),userAvatarURL:legacyEditorImage(r.userAvatarURL),html:content,time:new Date(legacyDate(r.time)).toISOString()}
 if(r.userNickname!==undefined)result.userNickname=text(r.userNickname,255)
 // Do not spread the old transport object, reaction receipt or embedded private packet recipients.
 if(r.sysMetal!==undefined){try{const source=typeof r.sysMetal==='string'?JSON.parse(text(r.sysMetal,65536)):r.sysMetal;const list=Array.isArray(source)?source:legacyObject(source).list;if(Array.isArray(list)&&list.length<=100)result.sysMetal=list.map(v=>{const m=legacyObject(v),attr=typeof m.attr==='string'?m.attr:'';for(const part of attr.split('&')){const i=part.indexOf('=');if(i>0)decodeURIComponent(part.slice(i+1))}return{name:text(m.name,255),description:typeof m.description==='string'?text(m.description,2048):'',attr}})}catch{/* malformed medals do not become identity or break the timeline */}}
 if(content.trim().startsWith('{')){
  result.html='<p>当前卡片不可读取</p>'
  try{const card=legacyObject(JSON.parse(content));if(card.msgType==='redPacket')result.html='<p>红包消息</p>';else if(card.msgType==='music'){const projected={msgType:'music' as const,title:text(card.title,1024),source:text(card.source,4096),coverURL:legacyEditorImage(card.coverURL),from:text(card.from,128)};result.card=projected;result.html=undefined}else if(card.msgType==='weather'){const field=(v:unknown)=>{if(typeof v==='string')return text(v,4096);if(Array.isArray(v)&&v.length<=10&&v.every(x=>typeof x==='string'&&x.length<=64||typeof x==='number'&&Number.isFinite(x)))return v.map(String);throw new ApiError('天气消息字段不正确',502)};const projected={msgType:'weather' as const,date:field(card.date),weatherCode:field(card.weatherCode),max:field(card.max),min:field(card.min),t:text(card.t,128),st:text(card.st,128)};result.card=projected;result.html=undefined}}catch{/* Unknown card envelopes are not rendered or spread into the timeline. */}
 }
 return result
}
function rows(value:unknown,max:number){if(!Array.isArray(value)||value.length>max)throw new ApiError('聊天室消息列表不正确',502);const list=value.map(projectLegacyChat);for(let i=1;i<list.length;i++)if(BigInt(list[i]!.oId)>=BigInt(list[i-1]!.oId))throw new ApiError('聊天室消息顺序不正确',502);return list.reverse()}
export async function legacyChatPage(page=1,signal?:AbortSignal){if(!Number.isSafeInteger(page)||page<1)throw new ApiError('聊天室页码不合法',422);return rows(await data(query('/chat-room/more',{page:String(page),type:'html'}),signal),25)}
export async function legacyChatDetail(id:string,signal?:AbortSignal){legacyChatId(id);const list=rows(await data(query('/chat-room/getMessage',{oId:id,mode:'0',size:'0',type:'html'},true),signal),1);if(list[0]?.oId!==id)throw new ApiError('当前消息不可读取',404);return list[0]}
export interface LegacyOnline{users:OnlineUser[];total:number;topic:string}
export function projectLegacyOnline(value:unknown):LegacyOnline{const r=legacyObject(value);if(r.type!=='online'||!Array.isArray(r.users)||r.users.length>10000||!Number.isSafeInteger(r.onlineChatCnt)||Number(r.onlineChatCnt)<0||Number(r.onlineChatCnt)!==r.users.length)throw new ApiError('聊天室在线数据不正确',502);const seen=new Set<string>(),users=r.users.map(v=>{const u=legacyObject(v),userName=name(u.userName);if(seen.has(userName.toLowerCase()))throw new ApiError('聊天室在线名单重复',502);seen.add(userName.toLowerCase());return{userName,userAvatarURL:legacyEditorImage(u.userAvatarURL20||u.userAvatarURL)}});return{users,total:r.onlineChatCnt as number,topic:text(r.discussing,4096)}}
export async function legacyChatOnline(signal?:AbortSignal){return projectLegacyOnline(await data(query('/chat-room/online-users',{}),signal))}
function nodeURL(v:unknown){const s=text(v,16384);let u:URL;try{u=new URL(s)}catch{throw new ApiError('聊天室节点地址不正确',502)}if(/[\u0000-\u0020\\]/.test(s)||u.username||u.password||u.hash||!(u.protocol==='wss:'||u.protocol==='ws:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw new ApiError('聊天室节点地址不正确',502);return u}
export async function legacyChatNode(preferred='',signal?:AbortSignal){const key=getLegacyKey();const r=legacyObject(await request(query('/chat-room/node/get',{},true),{signal,cache:'no-store'}));if(getLegacyKey()!==key)throw new ApiError('登录状态已变更',401);if(r.code!==0||!Array.isArray(r.avaliable)||r.avaliable.length>100||typeof r.apiKey!=='string'||!r.apiKey||r.apiKey.length>16384||/\s/.test(r.apiKey))throw new ApiError('聊天室节点响应不正确',502)
 const options:ChatNodeOption[]=r.avaliable.map(v=>{const n=legacyObject(v),u=nodeURL(n.node);if(u.search)throw new ApiError('节点目录不能携带凭据',502);return{node:u.href,name:text(n.name,255),...(typeof n.online==='number'&&Number.isSafeInteger(n.online)&&n.online>=0?{online:n.online}:{})}})
 if(new Set(options.map(n=>n.node)).size!==options.length)throw new ApiError('聊天室节点目录重复',502)
 const recommended=nodeURL(r.data);recommended.search='';const selected=options.find(n=>n.node===(preferred||recommended.href));if(!selected)throw new ApiError('当前节点不在服务端目录中',502)
 const target=nodeURL(selected.node);target.search=new URLSearchParams({apiKey:r.apiKey}).toString()
 return{url:target.href,name:selected.name,options}
}
export function legacyChatContent(content:string){if(typeof content!=='string'||!content.trim()||content.length>4096||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(content)||Array.from(content).some(c=>c.length===1&&/[\ud800-\udfff]/.test(c)))throw new ApiError('聊天室正文不合法',422);if(/^\[(redpacket|setdiscuss|barrager|weather|music)\]/.test(content.trim()))throw new ApiError('特殊消息请使用对应的发送入口',422);return content}
export async function legacyChatSend(content:string){legacyChatContent(content);const apiKey=getLegacyKey();if(!apiKey)throw new ApiError('请先登录聊天室',401);const r=legacyObject(await request('/chat-room/send',{method:'POST',body:JSON.stringify({apiKey,content,client:'Web/website_v3'}),cache:'no-store'}));if(typeof r.code!=='number')throw new ApiError('聊天室发送响应不完整，结果未确认',502);if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'聊天室发送失败',400)}
