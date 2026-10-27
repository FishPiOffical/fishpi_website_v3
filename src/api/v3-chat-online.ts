import {ApiError,request} from './http'
export interface ChatOnlineUser{id:string;userName:string;userAvatarURL:string}
export interface ChatOnlinePage{list:ChatOnlineUser[];page:number;size:number;total:number;pageCount:number;hasMore:boolean;nodesSampledAt:number;nodesComplete:boolean}
const invalid=()=>new ApiError('在线名单响应不正确',502)
function row(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw invalid();return v as Record<string,unknown>}
function count(v:unknown){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw invalid();return v}
function text(v:unknown){if(typeof v!=='string')throw invalid();return v}
export async function chatOnlinePage(page=1,signal?:AbortSignal):Promise<ChatOnlinePage>{if(!Number.isSafeInteger(page)||page<1||page>Math.floor(2147483647/50))throw new ApiError('在线名单页码不合法',422)
 const r=row(await request(`/api/v3/chat/online-users?p=${page}&size=20`,{signal,cache:'no-store'}));if(r.code!==0)throw invalid();const d=row(r.data),p=row(d.pagination),total=count(p.total),pageCount=count(p.pageCount);if(p.p!==page||p.size!==20||pageCount!==Math.ceil(total/20)||!Array.isArray(d.list)||d.list.length!==Math.max(0,Math.min(20,total-(page-1)*20))||typeof d.hasMore!=='boolean'||d.hasMore!==(page<pageCount))throw invalid()
 const list=d.list.map(v=>{const u=row(v),id=text(u.id),userName=text(u.userName);if(!/^\d{1,32}$/.test(id)||!userName)throw invalid();return{id,userName,userAvatarURL:text(u.userAvatarURL)}});if(new Set(list.map(u=>u.id)).size!==list.length)throw invalid()
 const nodesSampledAt=count(d.nodesSampledAt);if(!Number.isFinite(new Date(nodesSampledAt).getTime())||typeof d.nodesComplete!=='boolean')throw invalid();return{list,page,size:20,total,pageCount,hasMore:d.hasMore,nodesSampledAt,nodesComplete:d.nodesComplete}
}
