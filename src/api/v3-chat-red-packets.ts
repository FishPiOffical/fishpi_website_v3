import {ApiError,request} from './http'
export const PACKET_TYPES=['random','average','specify','heartbeat','rockPaperScissors'] as const
export type PacketType=typeof PACKET_TYPES[number]
export interface PacketInput{type:PacketType;money:number;message:string;count?:number;recipientIds?:string[];riskAccepted?:true;gesture?:number}
export interface ClaimInput{riskAccepted?:true;gesture?:number}
export interface PacketUser{id:string;userName:string;userNickname:string;userAvatarURL:string}
export interface ClaimResult{amount:number;claimedAt:number;gesture?:number;outcome?:'win'|'lose'|'tie';senderRefundPoints?:number}
export interface ClaimReceipt extends ClaimResult{id:string}
export interface CreateReceipt{id:string;createdAt:number;principalPoints:number;poolPoints:number;taxPoints:number}
export interface PacketDetail extends CreateReceipt{type:PacketType;message:string;money:number;count:number;got:number;sender:PacketUser;claims:(ClaimResult&{user:PacketUser})[];currentUserClaim:ClaimResult|null;senderGesture?:number;recipientIds?:string[]}
const invalid=()=>new ApiError('红包参数不合法',422),bad=()=>new ApiError('红包响应不正确',502)
const unicode=(s:string)=>!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(s)
export const packetRisk=(type:PacketType)=>type==='heartbeat'||type==='rockPaperScissors'
export function packetId(id:string){if(typeof id!=='string'||!(/^[1-9][0-9]{0,18}$/).test(id))throw invalid();return id}
function integer(v:unknown,min:number,max:number):v is number{return typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max}
export function packetInput(value:PacketInput,owner:string):PacketInput{
 if(!value||!PACKET_TYPES.includes(value.type)||!integer(value.money,value.type==='rockPaperScissors'?256:32,10240)||typeof value.message!=='string'||value.message.length>4096||!unicode(value.message)||/[\u0000-\u001f\u007f-\u009f]/u.test(value.message))throw invalid()
 // Preserve the submitted message for retries; the server applies the existing character filter.
 const filtered=value.message.replace(/[^0-9a-zA-Z\u4e00-\u9fa5,，.。！!?？《》 ]/gu,'')
 if(filtered.length>20)throw invalid()
 const input:PacketInput={type:value.type,money:value.money,message:value.message}
 if(packetRisk(value.type)){if(value.riskAccepted!==true)throw invalid();input.riskAccepted=true}else if(value.riskAccepted!==undefined)throw invalid()
 if(value.type==='specify'){if(value.count!==undefined||!Array.isArray(value.recipientIds)||value.recipientIds.length<1||value.recipientIds.length>100)throw invalid();const ids=Array.from(value.recipientIds);for(const id of ids)if(packetId(id)===owner)throw invalid();if(new Set(ids).size!==ids.length)throw invalid();input.recipientIds=ids}
 else{if(value.recipientIds!==undefined)throw invalid();if(value.type==='rockPaperScissors'){if(value.count!==undefined&&value.count!==1)throw invalid()}else{if(!integer(value.count,value.type==='heartbeat'?5:1,100))throw invalid();input.count=value.count}}
 if(value.type==='rockPaperScissors'){if(!integer(value.gesture,0,2))throw invalid();input.gesture=value.gesture}else if(value.gesture!==undefined)throw invalid()
 return input
}
export function packetPrincipal(input:PacketInput){return input.money*(input.type==='average'?input.count!:input.type==='specify'?input.recipientIds!.length:1)}
export function packetClaimInput(type:PacketType,input:ClaimInput):ClaimInput{
 if(!PACKET_TYPES.includes(type)||!input||typeof input!=='object')throw invalid();const body:ClaimInput={}
 if(packetRisk(type)){if(input.riskAccepted!==true)throw invalid();body.riskAccepted=true}else if(input.riskAccepted!==undefined)throw invalid()
 if(type==='rockPaperScissors'){if(!integer(input.gesture,0,2))throw invalid();body.gesture=input.gesture}else if(input.gesture!==undefined)throw invalid();return body
}
function row(v:unknown){if(!v||typeof v!=='object'||Array.isArray(v))throw bad();return v as Record<string,unknown>}
function num(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER){if(!integer(v,min,max))throw bad();return v}
function str(v:unknown,max=4096){if(typeof v!=='string'||v.length>max||!unicode(v))throw bad();return v}
function response(value:unknown){const r=row(value);if(r.code!==0)throw bad();return row(r.data)}
function identity(v:unknown){const s=str(v,19);if(!/^[1-9][0-9]{0,18}$/.test(s))throw bad();return s}
function moneyData(d:Record<string,unknown>):CreateReceipt{const principalPoints=num(d.principalPoints,32,1024000),poolPoints=num(d.poolPoints,0,principalPoints),taxPoints=num(d.taxPoints,0,principalPoints);if(principalPoints!==poolPoints+taxPoints)throw bad();return{id:identity(d.id),createdAt:num(d.createdAt),principalPoints,poolPoints,taxPoints}}
function claimData(d:Record<string,unknown>,type:PacketType):ClaimResult{const result:ClaimResult={amount:num(d.amount,packetRisk(type)?-1024000:0,1024000),claimedAt:num(d.claimedAt)};if(type==='rockPaperScissors'){result.gesture=num(d.gesture,0,2);if(!['win','lose','tie'].includes(String(d.outcome))||d.outcome!==(result.amount===0?'tie':result.amount>0?'win':'lose'))throw bad();result.outcome=d.outcome as ClaimResult['outcome'];result.senderRefundPoints=num(d.senderRefundPoints,0,20480);if(result.amount>0&&result.senderRefundPoints!==0||result.amount<0&&result.senderRefundPoints!==-2*result.amount||result.amount===0&&result.senderRefundPoints<=0)throw bad()}return result}
function user(value:unknown):PacketUser{const d=row(value),avatar=str(d.userAvatarURL,2048);let safe='';if(avatar)try{const u=new URL(avatar);if(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password)safe=avatar}catch{}return{id:identity(d.id),userName:str(d.userName),userNickname:str(d.userNickname),userAvatarURL:safe}}
function keyHeaders(key:string){if(typeof key!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(key))throw invalid();return{'Idempotency-Key':key}}
export async function createPacket(input:PacketInput,key:string,owner:string){const body=packetInput(input,owner),d=response(await request('/api/v3/chat/red-packets',{method:'POST',headers:keyHeaders(key),body:JSON.stringify(body)})),r=moneyData(d);if(r.principalPoints!==packetPrincipal(body))throw bad();return r}
export async function claimPacket(id:string,type:PacketType,input:ClaimInput,key:string):Promise<ClaimReceipt>{packetId(id);const d=response(await request(`/api/v3/chat/red-packets/${id}/claims`,{method:'POST',headers:keyHeaders(key),body:JSON.stringify(packetClaimInput(type,input))}));if(d.id!==id)throw bad();return{id,...claimData(d,type)}}
export async function packetDetail(id:string,owner:string,signal?:AbortSignal):Promise<PacketDetail>{packetId(id);const d=response(await request(`/api/v3/chat/red-packets/${id}`,{cache:'no-store',signal})),base=moneyData(d),type=d.type as PacketType;if(base.id!==id||!PACKET_TYPES.includes(type))throw bad();const count=num(d.count,type==='heartbeat'?5:1,100),got=num(d.got,0,count),sender=user(d.sender);if(!Array.isArray(d.claims)||d.claims.length!==got)throw bad()
 const claims=d.claims.map(c=>{const value=row(c);return{...claimData(value,type),user:user(value.user)}});if(new Set(claims.map(c=>c.user.id)).size!==claims.length||claims.some((c,i)=>i>0&&c.claimedAt<claims[i-1]!.claimedAt))throw bad()
 const currentUserClaim=d.currentUserClaim===null?null:claimData(row(d.currentUserClaim),type),mine=claims.find(c=>c.user.id===owner);if(!!mine!==!!currentUserClaim||mine&&currentUserClaim&&JSON.stringify(claimData(row(mine),type))!==JSON.stringify(currentUserClaim))throw bad()
 if(type==='rockPaperScissors'&&claims.some(c=>![base.poolPoints,0,-base.poolPoints].includes(c.amount)||c.senderRefundPoints!==base.poolPoints-c.amount))throw bad()
 const money=num(d.money,type==='rockPaperScissors'?256:32,10240);if(type==='rockPaperScissors'&&count!==1||base.principalPoints!==money*(type==='average'||type==='specify'?count:1))throw bad()
 const result:PacketDetail={...base,type,message:str(d.message,20),money,count,got,sender,claims,currentUserClaim}
 if(d.senderGesture!==undefined){if(type!=='rockPaperScissors'||sender.id!==owner&&got!==count)throw bad();result.senderGesture=num(d.senderGesture,0,2)}
 if(d.recipientIds!==undefined){if(type!=='specify'||sender.id!==owner||!Array.isArray(d.recipientIds)||d.recipientIds.length!==count)throw bad();result.recipientIds=d.recipientIds.map(identity);if(new Set(result.recipientIds).size!==count||result.recipientIds.includes(sender.id))throw bad()}
 return result
}
