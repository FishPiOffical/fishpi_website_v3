import {ApiError,request} from './http'
export interface ReportTarget{targetType:number;label:string;reasons:{reason:number;label:string}[]}
export interface ReportInput{targetType:number;targetId:string;reason:number;memo:string}
export interface ReportCommand{input:ReportInput;key:string}
export interface ReportReceipt{id:string}
const invalid=()=>new ApiError('举报响应不正确',502)
const unicode=(s:string)=>!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(s)
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw invalid();return v as Record<string,unknown>}
const reasonAllowed=(type:number,reason:number)=>type===3?reason===49:type===2?[5,6,7,49].includes(reason):[0,1,2,3,4,49].includes(reason)
export function reportTarget(type:number,id:string){if(!Number.isInteger(type)||type<0||type>3||typeof id!=='string'||!/^[1-9][0-9]{0,18}$/.test(id))throw new ApiError('举报目标不合法',422);return{targetType:type,targetId:id}}
export function reportInput(value:ReportInput):ReportInput{
 const target=reportTarget(value.targetType,value.targetId)
 if(!Number.isInteger(value.reason)||!reasonAllowed(target.targetType,value.reason)||typeof value.memo!=='string'||value.memo.length>10240||!unicode(value.memo)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value.memo))throw new ApiError('举报理由或备注不合法',422)
 // Preserve the original request; HTML removal and normalized storage belong to the server.
 return{...target,reason:value.reason,memo:value.memo}
}
export async function reportOptions(signal?:AbortSignal):Promise<ReportTarget[]>{
 const r=object(await request('/api/v3/report/options',{cache:'no-store',signal})),d=object(r.data)
 if(r.code!==0||!Array.isArray(d.targets)||d.targets.length!==4)throw invalid()
 const label=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>128||!unicode(v)||/[\u0000-\u001f\u007f-\u009f]/u.test(v))throw invalid();return v}
 const targets=d.targets.map(v=>{const t=object(v),type=t.targetType;if(typeof type!=='number'||!Number.isInteger(type)||type<0||type>3||!Array.isArray(t.reasons)||!t.reasons.length||t.reasons.length>50)throw invalid();const reasons=t.reasons.map(v=>{const r=object(v),reason=r.reason;if(typeof reason!=='number'||!Number.isInteger(reason)||!reasonAllowed(type,reason))throw invalid();return{reason,label:label(r.label)}});if(new Set(reasons.map(r=>r.reason)).size!==reasons.length)throw invalid();return{targetType:type,label:label(t.label),reasons}})
 if(new Set(targets.map(t=>t.targetType)).size!==4)throw invalid();return targets
}
export async function publishReport(command:ReportCommand):Promise<ReportReceipt>{
 const input=reportInput(command.input)
 if(typeof command.key!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(command.key))throw new ApiError('举报请求键不合法',422)
 const r=object(await request('/api/v3/reports',{method:'POST',headers:{'Idempotency-Key':command.key},body:JSON.stringify(input)})),d=object(r.data)
 if(r.code!==0||typeof d.id!=='string'||!/^[1-9][0-9]{0,18}$/.test(d.id))throw invalid()
 return{id:d.id}
}
