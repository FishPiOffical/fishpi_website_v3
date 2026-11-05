import {ApiError,getAuthContextVersion,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject} from './home'
import {legacyEditorImage} from './editor'
import type {EmojiGroup,EmojiItem} from '../fishpi'
import type {EmojiPage} from '../v3-emojis'
function id(v:unknown){if(typeof v!=='string'||!/^[1-9][0-9]{0,31}$/.test(v))throw new ApiError('表情ID格式不正确',502);return v}
function text(v:unknown){if(typeof v!=='string'||v.length>1024)throw new ApiError('表情字段格式不正确',502);return v}
function int(v:unknown){if(typeof v!=='number'||!Number.isSafeInteger(v))throw new ApiError('表情排序格式不正确',502);return v}
async function list(path:string,signal?:AbortSignal){const key=getLegacyKey(),context=getAuthContextVersion();if(!key)throw new ApiError('请先登录后使用表情',401);const r=legacyObject(await request(path+(path.includes('?')?'&':'?')+new URLSearchParams({apiKey:key}),{cache:'no-store',redirect:'error',signal}));if(getLegacyKey()!==key||context!==getAuthContextVersion())throw new ApiError('登录状态已变更',401);if(r.code!==0||!Array.isArray(r.data)||r.data.length>10000)throw new ApiError(typeof r.msg==='string'?r.msg:'表情列表响应不正确',502);return r.data}
function page<T>(rows:T[],p:number,size:number):EmojiPage<T>{if(!Number.isSafeInteger(p)||p<1||!Number.isSafeInteger(size)||size<1||size>50)throw new ApiError('表情分页参数不合法',422);return{list:rows.slice((p-1)*size,p*size),p,size,total:rows.length,pageCount:Math.ceil(rows.length/size)}}
export async function legacyFrequentEmotions(signal?:AbortSignal):Promise<EmojiItem[]>{const data=await list('/users/emotions',signal);return data.map(v=>{const r=legacyObject(v),names=Object.keys(r);if(names.length!==1||!/^[A-Za-z0-9_+-]{1,64}$/.test(names[0]!))throw new ApiError('常用表情响应不正确',502);const name=names[0]!,value=text(r[name]);const url=legacyEditorImage(value);if(!url&&(!/[^\u0000-\u007f]/u.test(value)||/[A-Za-z_<>/:.\\\u0000-\u001f\u007f]/u.test(value)))throw new ApiError('常用表情显示值不正确',502);return{name,text:`:${name}:`,...(url?{url}:{label:value})}})}
export async function legacyAllEmojiGroups():Promise<EmojiGroup[]>{const seen=new Set<string>(),rows=(await list('/api/emoji/groups')).map(v=>{const r=legacyObject(v),oId=id(r.oId);if(seen.has(oId))throw new ApiError('表情分组重复',502);seen.add(oId);return{oId,name:text(r.name),sort:int(r.sort),type:int(r.type)}});return rows}
export async function legacyAllGroupEmojis(groupId:string):Promise<EmojiItem[]>{id(groupId);const seen=new Set<string>(),rows=(await list('/api/emoji/group/emojis?'+new URLSearchParams({groupId}))).map(v=>{const r=legacyObject(v),oId=id(r.oId);if(seen.has(oId))throw new ApiError('表情成员重复',502);seen.add(oId);return{oId,emojiId:id(r.emojiId),name:text(r.name),sort:int(r.sort),url:legacyEditorImage(r.url)}});return rows}

export async function legacyEmojiGroups(p=1,size=50):Promise<EmojiPage<EmojiGroup>>{page([],p,size);return page(await legacyAllEmojiGroups(),p,size)}
export async function legacyGroupEmojis(groupId:string,p=1,size=50):Promise<EmojiPage<EmojiItem>>{page([],p,size);return page(await legacyAllGroupEmojis(groupId),p,size)}
