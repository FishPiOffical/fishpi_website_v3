import { getApiMode } from '@/api/mode'
import { getLegacyKey } from '@/api/legacy/auth'
import { getAccessToken, getAuthContextVersion, refreshAccessToken } from '@/api/http'
export const feedbackEnabled = import.meta.env.VITE_FEEDBACK_ENABLED === 'true'
export const categories: Record<string,string> = { feature:'功能建议', bug:'问题反馈', experience:'体验优化' }
export const statuses: Record<string,string> = { pending:'待评估', planned:'计划中', in_progress:'进行中', done:'已完成', declined:'不采纳' }
export type Vote = 'support' | 'oppose' | 'none'
export interface Feedback { id:string; title:string; category:string; description:string; authorName:string; authorNickname:string; status:string; note:string; support:number; oppose:number; createdAt:string; updatedAt:string }
export interface FeedbackList { items:Feedback[]; page:number; size:number; total:number; pageCount:number }
export interface Personal { vote:Vote; canModerate:boolean; moderation?:{ status:string; note:string; hidden:boolean } }
export class FeedbackError extends Error { status:number; constructor(message:string,status=0) { super(message); this.status=status } }
export async function feedbackApi<T>(path:string, options:{ method?:string; body?:unknown; key?:string; private?:boolean; signal?:AbortSignal } = {}):Promise<T> {
  if (!feedbackEnabled || import.meta.env.SSR) throw new FeedbackError('需求反馈未启用',503)
  const context = getAuthContextVersion()
  const send = async () => {
    if (context !== getAuthContextVersion()) throw new FeedbackError('登录身份已变化',401)
    const headers:Record<string,string> = { Accept:'application/json' }
    if (options.private && getApiMode()==='v1') {const key=getLegacyKey();if(!key) throw new FeedbackError('请先登录',401);headers['X-FP-API-Mode']='v1';headers['X-FP-Legacy-Key']=key}
    if (options.private && getApiMode()==='v3') { const token=getAccessToken(); if (!token) throw new FeedbackError('请先登录',401); headers.Authorization=`Bearer ${token}` }
    if (options.body !== undefined) headers['Content-Type']='application/json'
    if (options.key) headers['Idempotency-Key']=options.key
    return fetch('/feedback-api/v1'+path,{ method:options.method || 'GET',headers,body:options.body===undefined?undefined:JSON.stringify(options.body),credentials:'omit',redirect:'error',cache:'no-store',signal: options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) })
  }
  try {
    let r=await send()
    if (getApiMode()==='v3' && r.status===401 && options.private && await refreshAccessToken()) r=await send()
    const data=await r.json()
    if (context !== getAuthContextVersion()) throw new FeedbackError('登录身份已变化',401)
    if (!r.ok) throw new FeedbackError(typeof data.error==='string'?data.error:'反馈请求失败',r.status)
    return data as T
  } catch(e) { if (e instanceof FeedbackError) throw e; throw new FeedbackError('请求未确认，请重试；写入操作会沿用原操作') }
}
