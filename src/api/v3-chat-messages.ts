import {chatAppearanceSnapshot,type ChatAppearance} from '@/utils/chatAppearance'
import {ApiError,request} from './http'
import {decodeReactionSnapshot,type ReactionState} from './v3-reactions'
import type { PetSpeciesId } from './v3-pets'
export type ChatMessageType='text'|'music'|'weather'|'redPacket'|'unavailable'
export interface ChatTail{text:string}
export const chatPetStatusLabels = { idle: '空闲', rest: '休息中', outing: '外出中', course: '上课中', work: '兼职中', claimable: '待领取' } as const
export interface ChatPetStatus { name: string; state: keyof typeof chatPetStatusLabels; level?: number; speciesId?: PetSpeciesId }
const chatPetSpeciesIds = new Set<unknown>(['momota', 'hexiaotun', 'yubingmiao', 'paixiaoyu'] satisfies PetSpeciesId[])

function decodeChatPetStatus(value: unknown): ChatPetStatus | undefined {
  if (!value || typeof value !== 'object') return
  const { name, state, level, speciesId } = value as Record<string, unknown>
  if (typeof name !== 'string' || !name.trim() || name.length > 256 ||
      typeof state !== 'string' || !Object.hasOwn(chatPetStatusLabels, state)) return
  return { name, state: state as ChatPetStatus['state'],
    ...(chatPetSpeciesIds.has(speciesId) ? { speciesId: speciesId as PetSpeciesId } : {}),
    ...(typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 30 ? { level } : {}) }
}

export interface ChatMessage{petStatus?:ChatPetStatus;tail?:ChatTail;appearance?:ChatAppearance;reactions?:ReactionState|null;reactionsUnavailable?:boolean;reactionReadStarted?:number;id:string;createdAt:number;type:ChatMessageType;content:string;contentHtml:string;author:{id:string;userName:string;userNickname:string;userAvatarURL:string};client:string;card:Record<string,string|number>}
export {decodeReactionSnapshot}
const invalid=()=>new ApiError('聊天室消息响应不正确',502)
function row(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw invalid();return v as Record<string,unknown>}
function text(v:unknown){if(typeof v!=='string')throw invalid();return v}
/** 小尾巴是可选纯文本快照；坏扩展不能让有效消息整体消失。字素上限以服务端校验为准。 */
export function decodeChatTail(value: unknown): ChatTail | undefined {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
 const text = (value as Record<string, unknown>).text
 if (typeof text !== 'string' || !text.trim() || text.length > 512
  || /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/u.test(text)
  || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)) return undefined
 return { text }
}
function integer(v:unknown){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw invalid();return v}
export function chatMessageId(id:string){if(typeof id!=='string'||!/^\d{1,32}$/.test(id))throw new ApiError('消息ID不合法',422);return id}
export function decodeChatMessage(value:unknown):ChatMessage{const r=row(value),id=text(r.id);if(!/^\d{1,32}$/.test(id))throw invalid();const createdAt=integer(r.createdAt),type=text(r.type) as ChatMessageType;if(!['text','music','weather','redPacket','unavailable'].includes(type))throw invalid()
 if(type==='unavailable')return{id,createdAt,type,reactions:null,content:'',contentHtml:'',author:{id:'',userName:'',userNickname:'',userAvatarURL:''},client:'',card:{}}
 const a=row(r.author),authorId=text(a.id);if(authorId&&!/^\d{1,32}$/.test(authorId))throw invalid();const author={id:authorId,userName:text(a.userName),userNickname:text(a.userNickname),userAvatarURL:text(a.userAvatarURL)},client=text(r.client),card:Record<string,string|number>={}
 if(type!=='text'){const c=row(r.card);for(const field of type==='music'?['title','source','coverURL','from']:type==='weather'?['date','weatherCode','max','min','t','st']:['type','message'])card[field]=text(c[field]);if(type==='redPacket')for(const field of ['money','count','got'])card[field]=integer(c[field])}
 const petStatus = type === 'text' && authorId ? decodeChatPetStatus(r.petStatus) : undefined
 const tail = type === 'text' ? decodeChatTail(r.tail) : undefined
 const reactionsUnavailable = r.reactionsUnavailable === true
 const reactions = reactionsUnavailable || r.reactions === undefined ? undefined : decodeReactionSnapshot(r.reactions, 'chat', id)
 return{...(petStatus ? {petStatus} : {}),...(tail ? {tail} : {}),...(reactionsUnavailable ? {reactionsUnavailable:true} : {}),...(reactions ? {reactions,reactionReadStarted:performance.now()} : {}),...(r.appearance===undefined?{}:{appearance:chatAppearanceSnapshot(r.appearance)}),id,createdAt,type,author,client,content:type==='text'?text(r.content):'',contentHtml:type==='text'?text(r.contentHtml):'',card}}
export async function chatMessageDetail(id:string,signal?:AbortSignal):Promise<ChatMessage>{chatMessageId(id);const started=performance.now();const r=row(await request(`/api/v3/chat/messages/${id}`,{signal,cache:'no-store'}));if(r.code!==0)throw invalid();const message=decodeChatMessage(r.data);if(message.id!==id)throw invalid();return message.reactions ? {...message,reactionReadStarted:started} : message}
/** Card summaries are projected public fields, never the stored transport envelope. */
export function chatSourceText(message:ChatMessage){if(message.type==='unavailable')throw new ApiError('当前消息不可读取',404);return message.type==='text'?message.content:`【${message.type==='music'?'音乐':message.type==='weather'?'天气':'红包'}卡片公开摘要】\n${JSON.stringify(message.card,null,2)}`}
export interface ChatMessagePage{list:ChatMessage[];hasMore:boolean;nextBefore:string;nextAfter:string}
export async function chatMessagePage(options:{before?:string;after?:string;size?:number}={},signal?:AbortSignal):Promise<ChatMessagePage>{const {before,after,size=20}=options;if(before!==undefined)chatMessageId(before);if(after!==undefined)chatMessageId(after);if(before!==undefined&&after!==undefined||!Number.isSafeInteger(size)||size<1||size>50)throw new ApiError('消息游标不合法',422)
 const params=new URLSearchParams({size:String(size)});if(before!==undefined)params.set('before',before);if(after!==undefined)params.set('after',after)
 const started=performance.now()
 const r=row(await request(`/api/v3/chat/messages?${params}`,{signal,cache:'no-store'}));if(r.code!==0)throw invalid();const d=row(r.data);if(!Array.isArray(d.list)||d.list.length>size||typeof d.hasMore!=='boolean')throw invalid();const list=d.list.map(value=>{
   const message=decodeChatMessage(value)
   return message.reactions ? {...message,reactionReadStarted:started} : message
 })
 for(let i=0;i<list.length;i++){const id=BigInt(list[i]!.id);if(i&&BigInt(list[i-1]!.id)>=id||before!==undefined&&id>=BigInt(before)||after!==undefined&&id<=BigInt(after))throw invalid()}
 if(d.nextBefore!==(list[0]?.id||'')||d.nextAfter!==(list.at(-1)?.id||'')||d.hasMore&&!list.length)throw invalid();return{list,hasMore:d.hasMore,nextBefore:d.nextBefore as string,nextAfter:d.nextAfter as string}}
export async function chatTopic(signal?:AbortSignal){const r=row(await request('/api/v3/chat/topic',{signal,cache:'no-store'}));if(r.code!==0)throw invalid();return text(row(r.data).text)}
export interface ChatMessageContext{anchorId:string;list:ChatMessage[];hasMoreBefore:boolean;hasMoreAfter:boolean;nextBefore:string;nextAfter:string}
// 引用定位只读取目标前后各五条，避免为回看一条消息加载整段历史。
export const CHAT_CONTEXT_RADIUS = 5
export async function chatMessageContext(id:string,signal?:AbortSignal):Promise<ChatMessageContext>{chatMessageId(id);const r=row(await request(`/api/v3/chat/messages/${id}/context?radius=${CHAT_CONTEXT_RADIUS}`,{signal,cache:'no-store'}));if(r.code!==0)throw invalid();const d=row(r.data);if(d.anchorId!==id||!Array.isArray(d.list)||d.list.length<1||d.list.length>CHAT_CONTEXT_RADIUS*2+1||typeof d.hasMoreBefore!=='boolean'||typeof d.hasMoreAfter!=='boolean')throw invalid();const list=d.list.map(decodeChatMessage);for(let i=1;i<list.length;i++)if(BigInt(list[i-1]!.id)>=BigInt(list[i]!.id))throw invalid();const anchor=list.findIndex(m=>m.id===id);if(anchor<0||anchor>CHAT_CONTEXT_RADIUS||list.length-anchor-1>CHAT_CONTEXT_RADIUS||d.nextBefore!==list[0]!.id||d.nextAfter!==list.at(-1)!.id)throw invalid();return{anchorId:id,list,hasMoreBefore:d.hasMoreBefore,hasMoreAfter:d.hasMoreAfter,nextBefore:d.nextBefore as string,nextAfter:d.nextAfter as string}}
