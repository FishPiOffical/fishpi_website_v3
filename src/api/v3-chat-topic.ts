import {ApiError,request} from './http'
export interface ChatTopicCommand{text:string;key:string}
export interface ChatTopicReceipt{text:string;cost:number;revision:string}
export function topicInput(value:string){if(typeof value!=='string')throw new ApiError('话题不合法',422);const text=value.trim();if(!text||value.length>64||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value))throw new ApiError('话题须为1至64个UTF-16单位的有效文本',422);return text}
export async function setChatTopic(command:ChatTopicCommand):Promise<ChatTopicReceipt>{const text=topicInput(command.text);if(typeof command.key!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(command.key))throw new ApiError('话题请求键不合法',422)
 const r=await request<{code:number;data?:{text?:unknown;cost?:unknown;revision?:unknown}}>('/api/v3/chat/topic',{method:'PUT',headers:{'Idempotency-Key':command.key},body:JSON.stringify({text})}),d=r?.data
 if(r?.code!==0||typeof d?.text!=='string'||!d.text.trim()||d.text.length>64||d.cost!==16||typeof d.revision!=='string'||!/^\d{1,32}$/.test(d.revision))throw new ApiError('话题修改回执不正确',502)
 return{text:d.text,cost:d.cost,revision:d.revision}
}
