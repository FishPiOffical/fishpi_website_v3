import {ApiError,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject} from './home'
import {legacyPublicUser} from './public-user'
import type {MessagePeer,PrivateMessage} from '../v3-messages'
export const FILE_PEER:MessagePeer={id:'1000000000086',userName:'FileTransfer',userNickname:'文件传输助手',userAvatarURL:'',available:true,builtin:true}
export interface LegacyConversation{peer:MessagePeer;preview:string;sentAt:string}
export function legacyMessageId(v:unknown):string{if(typeof v!=='string'||! /^[1-9][0-9]{0,31}$/.test(v))throw new ApiError('私信ID格式不正确',502);return v}
export function legacyPeerName(v:unknown):string{if(typeof v!=='string'||! /^[A-Za-z0-9_-]{1,64}$/.test(v))throw new ApiError('请输入合法用户名',422);return v}
function image(v:unknown){if(typeof v!=='string'||v.length>2048||/[\u0000-\u0020\\]/.test(v))return '';try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?v:''}catch{return ''}}
function text(v:unknown,max=262144){if(typeof v!=='string'||v.length>max)throw new ApiError('私信字段格式不正确',502);return v}
export function legacyMessageContent(v:string){if(!v.trim()||v.length>10240||/[\u0000]/.test(v)||Array.from(v).some(c=>c.length===1&&/[\ud800-\udfff]/.test(c)))throw new ApiError('消息须为1～10240个合法字符',422);return v}
function credential(path:string,params:Record<string,string>={}){const key=getLegacyKey();if(!key)throw new ApiError('请先登录',401);return path+'?'+new URLSearchParams({...params,apiKey:key})}
function success(v:unknown){const r=legacyObject(v);if(r.code!==undefined&&r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'私信请求失败',400);if(r.result!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'私信响应不完整',typeof r.result==='number'?400:502);return r}
function time(v:unknown){const value=text(v,64);if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value))throw new ApiError('私信时间格式不正确',502);return value}
export function projectLegacyMessage(value:unknown,owner:string,peerId:string):PrivateMessage{
 const r=legacyObject(value),fromId=legacyMessageId(r.fromId),toId=legacyMessageId(r.toId),fromMe=fromId===owner
 if(!(fromMe?toId===peerId:fromId===peerId&&toId===owner))throw new ApiError('私信参与者不匹配',502)
 return{id:legacyMessageId(r.oId),fromId,toId,fromMe,sentAt:time(r.time),content:text(r.markdown),contentHtml:text(r.content),preview:text(r.preview,1024),available:true}
}
export async function legacyResolvePeer(name:string):Promise<MessagePeer>{legacyPeerName(name);if(name==='FileTransfer')return{...FILE_PEER};const user=await legacyPublicUser(name);return{id:user.id,userName:user.userName,userNickname:user.userNickname,userAvatarURL:user.userAvatarURL,available:true,builtin:false}}
export async function legacyMessageConversations(owner:string):Promise<LegacyConversation[]>{
 legacyMessageId(owner);const r=success(await request(credential('/chat/get-list'),{cache:'no-store'}))
 if(!Array.isArray(r.data)||r.data.length>10000)throw new ApiError('会话列表格式不正确',502)
 const peers=new Set<string>()
 return r.data.map(value=>{const row=legacyObject(value),from=legacyMessageId(row.fromId),to=legacyMessageId(row.toId)
  if(from!==owner&&to!==owner)throw new ApiError('会话不属于当前账号',502)
  const other=from===owner?to:from;if(other===owner||peers.has(other))throw new ApiError('会话列表重复或目标无效',502);peers.add(other)
  // get-list deliberately labels receiverUserName as the other participant, regardless of last-message direction.
  const peer=other===FILE_PEER.id?{...FILE_PEER}:{id:other,userName:legacyPeerName(row.receiverUserName),userNickname:'',userAvatarURL:image(row.receiverAvatar),available:true,builtin:false}
  return{peer,preview:text(row.preview,1024),sentAt:time(row.time)}
 })
}
export async function legacyMessageHistory(owner:string,peer:MessagePeer,page=1,size=20):Promise<PrivateMessage[]>{
 legacyMessageId(owner);legacyMessageId(peer.id);legacyPeerName(peer.userName)
 if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(size)||size<1||size>50)throw new ApiError('私信分页参数无效',422)
 const value=legacyObject(await request(credential('/chat/get-message',{toUser:peer.userName,page:String(page),pageSize:String(size)}),{cache:'no-store'}))
 // This exact result is the documented classic end-of-history response, not an arbitrary error fallback.
 if((value.code===undefined||value.code===0)&&value.result===-1&&value.msg==='没有更多消息了')return[]
 const r=success(value);if(!Array.isArray(r.data)||r.data.length>size)throw new ApiError('私信历史格式不正确',502)
 const rows=r.data.map(v=>projectLegacyMessage(v,owner,peer.id))
 for(let i=1;i<rows.length;i++)if(BigInt(rows[i].id)>=BigInt(rows[i-1].id))throw new ApiError('私信历史顺序不正确',502)
 return rows.reverse()
}
export async function legacyMessageUnread(owner:string):Promise<{total:number;byPeer:Record<string,number>}>{
 legacyMessageId(owner);const r=legacyObject(await request(credential('/chat/has-unread'),{cache:'no-store'}))
 if(r.code!==undefined&&r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'私信未读读取失败',400)
 if(!Number.isSafeInteger(r.result)||Number(r.result)<0||!Array.isArray(r.data)||r.data.length>10000||r.result!==r.data.length)throw new ApiError('私信未读响应不完整',502)
 const byPeer:Record<string,number>=Object.create(null)
 for(const value of r.data){const row=legacyObject(value),from=legacyMessageId(row.fromId);if(row.toId!==owner)throw new ApiError('未读消息不属于当前账号',502);byPeer[from]=(byPeer[from]||0)+1}
 return{total:r.result as number,byPeer}
}
export type LegacyMessageCommand={kind:'send'|'withdraw'|'read'|'read-all';peer:MessagePeer|null;messageId:string;content:string}
export async function writeLegacyMessage(command:LegacyMessageCommand){
 if(command.kind==='send')throw new ApiError('私信发送须使用当前会话连接',422)
 const path=command.kind==='withdraw'?'/chat/revoke':command.kind==='read-all'?'/chat/mark-all-as-read':'/chat/mark-as-read'
 const params:Record<string,string>=command.kind==='withdraw'?{oId:legacyMessageId(command.messageId)}:command.kind==='read'?{fromUser:legacyPeerName(command.peer?.userName)}:{}
 success(await request(credential(path,params),{cache:'no-store'}))
}
