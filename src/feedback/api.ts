export const feedbackEnabled = import.meta.env.VITE_FEEDBACK_ENABLED === 'true'
export const categories: Record<string,string> = { feature:'功能建议', bug:'问题反馈', experience:'体验优化' }
export const statuses: Record<string,string> = { pending:'待评估', planned:'计划中', in_progress:'进行中', done:'已完成', declined:'不采纳' }
export type Vote = 'support' | 'oppose' | 'none'
export interface Feedback { hidden?:boolean; id:string; title:string; category:string; description:string; authorName:string; authorNickname:string; status:string; note:string; support:number; oppose:number; createdAt:string; updatedAt:string }
export interface FeedbackList { items:Feedback[]; page:number; size:number; total:number; pageCount:number }
export interface Personal { vote:Vote; canModerate:boolean; moderation?:{ status:string; note:string; hidden:boolean } }
export class FeedbackError extends Error { status:number; constructor(message:string,status=0) { super(message); this.status=status } }
export interface Visitor { id:string; displayName:string }
let visitor: Visitor|null=null, visitorFlight:Promise<Visitor>|null=null, context=0
const listeners=new Set<()=>void>()
export const getFeedbackContextVersion=()=>context
export function onFeedbackIdentityChange(fn:()=>void) { listeners.add(fn); return ()=>{listeners.delete(fn)} }
function identityChanged(next:Visitor|null) { if(visitor?.id===next?.id)return; visitor=next;context++;for(const fn of listeners)fn() }
async function send<T>(path:string, options:{method?:string;body?:unknown;key?:string;signal?:AbortSignal;authorization?:string}={}):Promise<T> {
  if (!feedbackEnabled || import.meta.env.SSR) throw new FeedbackError('需求反馈未启用',503)
  const headers:Record<string,string>={Accept:'application/json'}
  if(options.body!==undefined)headers['Content-Type']='application/json'
  if(options.key)headers['Idempotency-Key']=options.key
  if(options.authorization)headers.Authorization=options.authorization
  try {
    const r=await fetch('/feedback-api/v1'+path,{method:options.method||'GET',headers,body:options.body===undefined?undefined:JSON.stringify(options.body),credentials:'same-origin',redirect:'error',cache:'no-store',signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)})
    const data=await r.json()
    if(!r.ok) {throw new FeedbackError(typeof data.error==='string'?data.error:'反馈请求失败',r.status)}
    return data as T
  }catch(e){if(e instanceof FeedbackError)throw e;throw new FeedbackError(options.method && options.method !== 'GET' ? '请求未确认，请重试；写入操作会沿用原操作' : '暂时无法读取需求，请稍后重试')}
}
export async function ensureFeedbackVisitor():Promise<Visitor> {
  if(visitor)return visitor
  if(visitorFlight)return visitorFlight
  const pending=send<Visitor>('/session',{method:'POST',body:{}}).then(value=>{
    if(!/^guest:[0-9a-f-]{36}$/.test(value.id)||typeof value.displayName!=='string')throw new FeedbackError('访客身份响应异常',503)
    identityChanged(value);return value
  }).finally(()=>{if(visitorFlight===pending)visitorFlight=null})
  visitorFlight=pending;return pending
}
export async function feedbackApi<T>(path:string, options:{method?:string;body?:unknown;key?:string;private?:boolean;signal?:AbortSignal}={}):Promise<T> {
  if(options.private)await ensureFeedbackVisitor()
  const version=context
  try {
    const result=await send<T>(path,options)
    if(options.private && version!==context)throw new FeedbackError('访客身份已变化，请重新操作',401)
    return result
  } catch(e) {
    if(options.private && version===context && e instanceof FeedbackError && e.status===401)identityChanged(null)
    throw e
  }
}


export function feedbackModerationApi<T>(path:string, token:string, options:{method?:'PATCH';body?:unknown;key?:string;signal?:AbortSignal}={}):Promise<T> {
  if (!/^\/(?:access|requests(?:\/[a-f0-9-]{36})?)(?:\?.*)?$/.test(path) || !token) {
    return Promise.reject(new FeedbackError('请先登录摸鱼派',401))
  }
  return send<T>('/moderation'+path,{...options,authorization:'Bearer '+token})
}
