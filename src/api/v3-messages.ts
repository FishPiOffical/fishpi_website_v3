import {ApiError,request} from './http'
export interface MessagePeer{id:string;userName:string;userNickname:string;userAvatarURL:string;available:boolean;builtin:boolean}
export interface PrivateMessage{id:string;fromId:string;toId:string;fromMe:boolean;sentAt:string;content:string;contentHtml:string;preview:string;available:boolean}
export interface Conversation{peerId:string;peer:MessagePeer;lastMessage:PrivateMessage;unreadCount:number}
export interface MessageHistory{peerId:string;peer:MessagePeer;list:PrivateMessage[];hasMore:boolean;nextBefore:string;nextAfter:string}
export type MessageCommand={kind:'send'|'withdraw'|'read'|'read-all';target:string;key:string;content?:string}
type Row=Record<string,unknown>
const invalid=()=>new ApiError('私信响应不正确',502)
const row=(v:unknown):Row=>{if(!v||typeof v!=='object'||Array.isArray(v))throw invalid();return v as Row}
const text=(v:unknown)=>{if(typeof v!=='string')throw invalid();return v}
const bool=(v:unknown)=>{if(typeof v!=='boolean')throw invalid();return v}
const count=(v:unknown)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw invalid();return v}
export function messageId(v:string){if(typeof v!=='string'||!/^[1-9][0-9]{0,18}$/.test(v))throw new ApiError('私信ID不合法',422);return v}
const id=(v:unknown)=>{const s=text(v);if(!/^[1-9][0-9]{0,18}$/.test(s))throw invalid();return s}
async function data(path:string,init?:RequestInit){const e=row(await request(path,{cache:'no-store',...init}));if(e.code!==0)throw invalid();return row(e.data)}
function peer(v:unknown):MessagePeer{const r=row(v);return{id:id(r.id),userName:text(r.userName),userNickname:text(r.userNickname),userAvatarURL:text(r.userAvatarURL),available:bool(r.available),builtin:bool(r.builtin)}}
function message(v:unknown,owner:string,other:string):PrivateMessage{const r=row(v),fromId=id(r.fromId),toId=id(r.toId),fromMe=bool(r.fromMe),available=bool(r.available);if(fromMe?fromId!==owner||toId!==other:fromId!==other||toId!==owner)throw invalid();return{id:id(r.id),fromId,toId,fromMe,sentAt:text(r.sentAt),content:available?text(r.content):'',contentHtml:available?text(r.contentHtml):'',preview:available?text(r.preview):'',available}}
export async function messageConversations(owner:string,p=1){messageId(owner);if(!Number.isSafeInteger(p)||p<1)throw new ApiError('页码不合法',422);const r=await data(`/api/v3/me/conversations?p=${p}&size=20`),pagination=row(r.pagination);if(!Array.isArray(r.list)||r.list.length>20||pagination.p!==p||pagination.size!==20)throw invalid();const total=count(pagination.total),pageCount=count(pagination.pageCount);if(pageCount!==Math.ceil(total/20))throw invalid();const list=r.list.map(v=>{const c=row(v),peerId=id(c.peerId),other=peer(c.peer);if(other.id!==peerId||peerId===owner)throw invalid();return{peerId,peer:other,lastMessage:message(c.lastMessage,owner,peerId),unreadCount:count(c.unreadCount)}});if(new Set(list.map(c=>c.peerId)).size!==list.length)throw invalid();return{list,p,pageCount,total}}
export async function messageHistory(owner:string,target:string,before='',signal?:AbortSignal):Promise<MessageHistory>{messageId(owner);messageId(target);if(before)messageId(before);const r=await data(`/api/v3/me/conversations/${target}/messages?size=20${before?'&before='+before:''}`,{signal});if(r.peerId!==target||!Array.isArray(r.list)||r.list.length>20)throw invalid();const other=peer(r.peer);if(other.id!==target)throw invalid();const list=r.list.map(v=>message(v,owner,target));for(let i=0;i<list.length;i++){if((i>0&&BigInt(list[i-1]!.id)>=BigInt(list[i]!.id))||(before&&BigInt(list[i]!.id)>=BigInt(before)))throw invalid()}
 const nextBefore=text(r.nextBefore),nextAfter=text(r.nextAfter),hasMore=bool(r.hasMore);if(nextBefore!==(list[0]?.id||'')||nextAfter!==(list.at(-1)?.id||'')||hasMore&&!list.length)throw invalid();return{peerId:target,peer:other,list,hasMore,nextBefore,nextAfter}}
export async function resolveMessagePeer(name:string):Promise<MessagePeer>{const value=name.trim();if(!value||value.length>64||/[\u0000-\u001f\u007f/\\]/.test(value))throw new ApiError('用户名不合法',422);const r=await data(`/api/v3/users/${encodeURIComponent(value)}`);if(typeof r.userName!=='string'||r.userName.toLowerCase()!==value.toLowerCase())throw invalid();return{id:id(r.id),userName:r.userName,userNickname:text(r.userNickname),userAvatarURL:text(r.userAvatarURL),available:true,builtin:false}}
export async function privateUnread(){return count((await data('/api/v3/me/messages/unread-count')).count)}
export async function writeMessage(c:MessageCommand){if(!['send','withdraw','read','read-all'].includes(c.kind)||typeof c.key!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(c.key))throw new ApiError('私信操作不合法',422);if(c.kind!=='read-all')messageId(c.target)
 let path='/api/v3/me/conversations/read',method='POST',body:string|undefined='{}'
 if(c.kind==='send'){const content=typeof c.content==='string'?c.content.trim():'';if(!content||content.length>10240||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(content))throw new ApiError('私信正文须为1至10240个字符',422);path=`/api/v3/me/conversations/${c.target}/messages`;body=JSON.stringify({content})}
 else if(c.kind==='withdraw'){path=`/api/v3/me/messages/${c.target}`;method='DELETE';body=undefined}else if(c.kind==='read')path=`/api/v3/me/conversations/${c.target}/read`
 const r=await data(path,{method,headers:{'Idempotency-Key':c.key},...(body===undefined?{}:{body})})
 if(c.kind==='read'||c.kind==='read-all')return{kind:c.kind,changed:count(r.changed)}
 if(r.id!==c.target&&c.kind==='withdraw'||c.kind==='send'&&r.peerId!==c.target)throw invalid();const result={kind:c.kind,id:id(r.id),peerId:id(r.peerId)}
 if(c.kind==='withdraw'&&r.removed!==true)throw invalid();if(c.kind==='send')text(r.sentAt);return result
}
