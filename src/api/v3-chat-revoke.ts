import {ApiError,request} from './http'
export interface ChatRevokeCommand{id:string;key:string}
export interface ChatRevokeReceipt{id:string;removed:true;cost:number}
export async function revokeChatMessage(command:ChatRevokeCommand):Promise<ChatRevokeReceipt>{
 if(typeof command.id!=='string'||typeof command.key!=='string'||!/^\d{1,32}$/.test(command.id)||!/^[A-Za-z0-9._:-]{1,128}$/.test(command.key))throw new ApiError('撤回参数不合法',422)
 const r=await request<{code:number;data?:{id?:unknown;removed?:unknown;cost?:unknown}}>(`/api/v3/chat/messages/${command.id}`,{method:'DELETE',headers:{'Idempotency-Key':command.key}}),d=r?.data
 if(r?.code!==0||d?.id!==command.id||d.removed!==true||typeof d.cost!=='number'||!Number.isSafeInteger(d.cost)||d.cost<0)throw new ApiError('撤回回执不正确',502)
 return{id:command.id,removed:true,cost:d.cost}
}
