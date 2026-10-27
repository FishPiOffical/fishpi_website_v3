import {ApiError,request} from './http'
export interface ChatMusicInput{title:string;from:string;source:string;coverURL:string}
export interface ChatMusicCommand{input:ChatMusicInput;key:string}
export interface ChatMusicReceipt{id:string;createdAt:number}
const invalid=()=>new ApiError('音乐卡片参数不合法',422)
const unicode=(s:string)=>!/[\u0000-\u001f\u007f-\u009f]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(s)
const strip=(s:string)=>s.replace(/^[ \u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]+|[ \u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]+$/gu,'')
function text(s:string,max:number,optional=false){if(typeof s!=='string'||!unicode(s))throw invalid();const v=strip(s);if(!optional&&!v||v.length>max||/<[^>]*>/su.test(v))throw invalid();return v}
function https(s:string){
 if(typeof s!=='string'||!s||s.length>2048||!unicode(s)||/[\s\\<>"{}|^`]/u.test(s))throw invalid()
 try{const u=new URL(s);if(u.protocol!=='https:'||!u.hostname||u.username||u.password||u.hash||s.includes('#')||!/^https:\/\/[^/?#]+/i.test(s)||s.match(/^https:\/\/([^/?#]+)/i)![1]!.includes('@')||/%(?![0-9a-f]{2})/i.test(s)||(!u.hostname.startsWith('[')&&!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.?$/i.test(u.hostname))||/[^\x00-\x7f]/.test(s.match(/^https:\/\/([^/?#]+)/i)![1]!))throw invalid();return s}catch{throw invalid()}
}
export function musicInput(input:ChatMusicInput):ChatMusicInput{
 if(!input||typeof input!=='object')throw invalid()
 return{title:text(input.title,128),from:text(input.from,64,true),source:typeof input.source==='string'&&/^[0-9]{1,32}$/.test(input.source)?input.source:https(input.source),coverURL:input.coverURL===''?'':https(input.coverURL)}
}
export async function sendChatMusic(command:ChatMusicCommand):Promise<ChatMusicReceipt>{
 const input=musicInput(command.input)
 if(typeof command.key!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(command.key))throw invalid()
 const r=await request<{code:number;data?:{id?:unknown;createdAt?:unknown}}>('/api/v3/chat/music',{method:'POST',headers:{'Idempotency-Key':command.key},body:JSON.stringify(input)}),d=r?.data
 if(r?.code!==0||typeof d?.id!=='string'||!/^\d{1,32}$/.test(d.id)||typeof d.createdAt!=='number'||!Number.isSafeInteger(d.createdAt)||d.createdAt<0)throw new ApiError('音乐卡片回执不正确',502)
 return{id:d.id,createdAt:d.createdAt}
}
/** Numeric song IDs are links, never relative audio URLs; no remote request until user action. */
export function musicDestination(source:string):{audio:string;page:string}{
 if(typeof source==='string'&&/^[0-9]{1,32}$/.test(source))return{audio:'',page:'https://music.163.com/song?id='+source}
 try{if(typeof source!=='string'||source.length>2048||!unicode(source)||/[\s\\]/u.test(source)||!/^https?:\/\//i.test(source))return{audio:'',page:''};const u=new URL(source);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return{audio:'',page:''};return{audio:source,page:''}}catch{return{audio:'',page:''}}
}
