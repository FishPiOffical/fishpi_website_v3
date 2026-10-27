import { ApiError, request } from './http'
export type InteractionResource = 'articles' | 'comments'
export type ArticleInteractionKind = 'vote' | 'thanks' | 'reward' | 'accept'
export type VoteChoice = 'up' | 'down' | null
export type VoteState = { kind:'vote'; id:string; vote:VoteChoice; upCount:number; downCount:number }
export type ThanksState = { kind:'thanks'; id:string; thanked:boolean; thankCount:number; thankPoint:number; canThank?:boolean }
export type RewardState = { kind:'reward'; id:string; rewarded:boolean; rewardPoint:number }
export type AcceptState = { kind:'accept'; id:string; accepted:boolean; canAccept:boolean; offerPoint:number }
export type ArticleInteractionState = VoteState | ThanksState | RewardState | AcceptState
const invalid = () => new ApiError('互动响应不正确', 502)
function row(value:unknown):Record<string,unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Record<string,unknown> }
function integer(value:unknown,min=0) { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) throw invalid(); return value }
function boolean(value:unknown) { if (typeof value !== 'boolean') throw invalid(); return value }
function path(kind:ArticleInteractionKind,id:string,resource:InteractionResource='articles') { if (!['articles','comments'].includes(resource) || resource === 'comments' && kind === 'reward' || resource === 'articles' && kind === 'accept') throw new ApiError('互动类型不合法',422); if (!['vote','thanks','reward','accept'].includes(kind) || !/^[1-9][0-9]{0,18}$/.test(id)) throw new ApiError('互动目标不合法',422); return `/api/v3/${resource}/${id}/${kind}` }
function data(value:unknown,id:string) { const envelope=row(value), result=row(envelope.data); if (envelope.code !== 0 || result.id !== id) throw invalid(); return result }
function voteState(result:Record<string,unknown>,id:string):VoteState { if (result.vote !== null && result.vote !== 'up' && result.vote !== 'down') throw invalid(); return {kind:'vote',id,vote:result.vote,upCount:integer(result.upCount),downCount:integer(result.downCount)} }
export async function readArticleInteraction(kind:ArticleInteractionKind,id:string,resource:InteractionResource='articles'):Promise<ArticleInteractionState> {
  const result=data(await request(path(kind,id,resource),{cache:'no-store'}),id)
  if (kind === 'vote') return voteState(result,id)
  if (kind === 'accept') return {kind,id,accepted:boolean(result.accepted),canAccept:boolean(result.canAccept),offerPoint:integer(result.offerPoint)}
  if (kind === 'thanks') return {kind,id,thanked:boolean(result.thanked),thankCount:integer(result.thankCount),thankPoint:integer(result.thankPoint),...(resource === 'comments' ? {canThank:boolean(result.canThank)} : {})}
  return {kind,id,rewarded:boolean(result.rewarded),rewardPoint:integer(result.rewardPoint,Number.MIN_SAFE_INTEGER)}
}
export async function writeArticleInteraction(kind:ArticleInteractionKind,id:string,choice:VoteChoice,key:string,resource:InteractionResource='articles'):Promise<void> {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(key) || (kind === 'vote' ? choice !== null && choice !== 'up' && choice !== 'down' : choice !== null)) throw new ApiError('互动参数不合法',422)
  const result=data(await request(path(kind,id,resource),{method:kind === 'vote' ? choice === null ? 'DELETE' : 'PUT' : 'POST',headers:{'Idempotency-Key':key},...(kind === 'vote' && choice !== null ? {body:JSON.stringify({vote:choice})} : {})}),id)
  if (kind === 'vote') { if (voteState(result,id).vote !== choice) throw invalid() }
  else if (result[kind === 'thanks' ? 'thanked' : kind === 'accept' ? 'accepted' : 'rewarded'] !== true) throw invalid()
}
/** Reward HTML is only accepted from a fresh, currently authorized article detail. */
export async function readArticleRewardHtml(id:string):Promise<string> {
  path('reward',id)
  const result=data(await request(`/api/v3/articles/${id}`,{cache:'no-store'}),id)
  if (result.rewarded !== true || typeof result.rewardContentHtml !== 'string') throw invalid()
  return result.rewardContentHtml
}
