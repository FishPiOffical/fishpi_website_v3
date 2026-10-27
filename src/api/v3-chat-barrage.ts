import {ApiError,request} from './http'
export interface ChatBarrageCommand{content:string;color:string;key:string}
export interface ChatBarragePrice{amount:number;unit:string}
export interface ChatBarrageReceipt{id:string;createdAt:number;cost:number;unit:string}
const validText=(s:string)=>!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(s)
export function barrageInput(content:string,color='#FFFFFF'){
 if(typeof content!=='string'||!content.trim()||content.length>4096||!validText(content)||typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))throw new ApiError('弹幕正文或颜色不合法',422)
 return{content,color:color.toUpperCase()}
}
const amount=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0
const unit=(v:unknown):v is string=>typeof v==='string'&&v.length<=128&&validText(v)
export async function barragePrice(signal?:AbortSignal):Promise<ChatBarragePrice>{
 const r=await request<{code:number;data?:{amount?:unknown;unit?:unknown}}>('/api/v3/chat/barrager/price',{cache:'no-store',signal}),d=r?.data
 if(r?.code!==0||!amount(d?.amount)||!unit(d?.unit))throw new ApiError('弹幕价格响应不正确',502)
 return{amount:d.amount,unit:d.unit}
}
export async function sendChatBarrage(command:ChatBarrageCommand):Promise<ChatBarrageReceipt>{
 const input=barrageInput(command.content,command.color)
 if(typeof command.key!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(command.key))throw new ApiError('弹幕请求键不合法',422)
 const r=await request<{code:number;data?:{id?:unknown;createdAt?:unknown;cost?:unknown;unit?:unknown}}>('/api/v3/chat/barrager',{method:'POST',headers:{'Idempotency-Key':command.key},body:JSON.stringify(input)}),d=r?.data
 if(r?.code!==0||typeof d?.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(d.id)||!amount(d.createdAt)||!amount(d.cost)||!unit(d.unit))throw new ApiError('弹幕发送回执不正确',502)
 return{id:d.id,createdAt:d.createdAt,cost:d.cost,unit:d.unit}
}
