import {ApiError,request} from './http'
export type ChatPublicationCommand={content:string;client:string;key:string}
export type ChatPublicationReceipt={id:string;createdAt:number}
export function chatPublicationContent(value:string){if(typeof value!=='string')throw new ApiError('消息正文不合法',422);const content=value.trim();if(!content||content.length>4096||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(content))throw new ApiError('消息正文须为1至4096个字符',422);return content}
export async function publishChat(command:ChatPublicationCommand):Promise<ChatPublicationReceipt>{const content=chatPublicationContent(command.content);if(command.client!=='Web/PC网页端'||typeof command.key!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(command.key))throw new ApiError('发送参数不合法',422)
 const r=await request<{code:number;data?:{id?:unknown;createdAt?:unknown}}>('/api/v3/chat/messages',{method:'POST',headers:{'Idempotency-Key':command.key},body:JSON.stringify({content,client:command.client})}),d=r?.data
 if(r?.code!==0||typeof d?.id!=='string'||!/^\d{1,32}$/.test(d.id)||typeof d.createdAt!=='number'||!Number.isSafeInteger(d.createdAt)||d.createdAt<0)throw new ApiError('发送回执不正确',502)
 return{id:d.id,createdAt:d.createdAt}
}
