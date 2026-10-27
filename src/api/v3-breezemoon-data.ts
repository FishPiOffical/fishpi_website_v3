import { ApiError } from './http'
import { decodeV3RelationUser, type RelationUser } from './v3-user-relations'
export type BreezemoonSummary={id:string;contentHtml:string;createdAt:number;updatedAt:number;author:RelationUser}
export type V3Breezemoon=BreezemoonSummary&{content:string}
const invalid=()=>new ApiError('清风明月响应格式不正确',502,'invalid_response')
export function breezemoonId(value:unknown):string{if(typeof value!=='string'||!/^[1-9][0-9]{0,18}$/.test(value))throw invalid();return value}
function row(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw invalid();return value as Record<string,unknown>}
function time(value:unknown):number{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||!Number.isFinite(new Date(value).getTime()))throw invalid();return value}
export function decodeBreezemoonSummary(value:unknown):BreezemoonSummary{const item=row(value);if(typeof item.contentHtml!=='string')throw invalid();return{id:breezemoonId(item.id),contentHtml:item.contentHtml,createdAt:time(item.createdAt),updatedAt:time(item.updatedAt),author:decodeV3RelationUser(item.author)}}
export function decodeBreezemoon(value:unknown):V3Breezemoon{const item=row(value);if(typeof item.content!=='string')throw invalid();return{...decodeBreezemoonSummary(item),content:item.content}}
