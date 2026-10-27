import {ApiError,request} from './http'
export interface ChatMutedUser{id:string;userName:string;userNickname:string;userAvatarURL:string;expiresAt:number}
export interface ChatMutePage{list:ChatMutedUser[];page:number;size:number;total:number;pageCount:number;hasMore:boolean}
const invalid=()=>new ApiError('思过崖响应不正确',502)
function row(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw invalid();return v as Record<string,unknown>}
function count(v:unknown){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw invalid();return v}
function text(v:unknown){if(typeof v!=='string')throw invalid();return v}
export async function chatMutePage(page=1,signal?:AbortSignal):Promise<ChatMutePage>{if(!Number.isSafeInteger(page)||page<1||page>Math.floor(2147483647/50))throw new ApiError('思过崖页码不合法',422)
 const r=row(await request(`/api/v3/chat/mutes?p=${page}&size=20`,{signal,cache:'no-store'}));if(r.code!==0)throw invalid();const d=row(r.data),p=row(d.pagination),total=count(p.total),pageCount=count(p.pageCount);if(p.p!==page||p.size!==20||pageCount!==Math.ceil(total/20)||!Array.isArray(d.list)||d.list.length!==Math.max(0,Math.min(20,total-(page-1)*20))||typeof d.hasMore!=='boolean'||d.hasMore!==(page<pageCount))throw invalid()
 const list=d.list.map(v=>{const u=row(v),id=text(u.id),userName=text(u.userName),expiresAt=count(u.expiresAt),userNickname=text(u.userNickname);if(!/^[1-9][0-9]{0,18}$/.test(id)||!/^[A-Za-z0-9_-]{1,64}$/.test(userName)||!Number.isFinite(new Date(expiresAt).getTime()))throw invalid();const avatar=text(u.userAvatarURL);let userAvatarURL='';try{const uri=new URL(avatar,'https://local.invalid');if(!/[\\\u0000-\u0020\u007f]/.test(avatar)&&!avatar.startsWith('//')&&!uri.username&&!uri.password&&['https:','http:'].includes(uri.protocol)&&(avatar.startsWith('/')||/^https?:\/\//i.test(avatar)))userAvatarURL=avatar}catch{}return{id,userName,userNickname,userAvatarURL,expiresAt}});if(new Set(list.map(u=>u.id)).size!==list.length)throw invalid()
 for(let i=1;i<list.length;i++){const a=list[i-1]!,b=list[i]!;if(a.expiresAt>b.expiresAt||(a.expiresAt===b.expiresAt&&a.id>b.id))throw invalid()}
 return{list,page,size:20,total,pageCount,hasMore:d.hasMore}
}
