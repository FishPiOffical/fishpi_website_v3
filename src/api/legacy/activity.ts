import {ApiError,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject} from './home'
import type {CheckinState} from '../v3-activity'
const bad=()=>new ApiError('旧活动响应格式不正确',502)
async function read(path:string,mutation=false){const apiKey=getLegacyKey();if(!apiKey)throw new ApiError('请先登录查看活动',401);const value=legacyObject(await request(path+'?'+new URLSearchParams({apiKey}),{cache:'no-store',...(mutation?{__captchaRetried:true}:{})}));if(apiKey!==getLegacyKey())throw new ApiError('登录状态已变化',409);return value}
function count(v:unknown,integer=true){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>Number.MAX_SAFE_INTEGER||integer&&!Number.isSafeInteger(v))throw bad();return v}
export async function legacyCheckin():Promise<CheckinState>{const r=await read('/api/checkin/status');if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'签到状态读取失败',502);const d=legacyObject(r.data);if(typeof d.checkedIn!=='boolean')throw bad();return{checkedIn:d.checkedIn,liveness:count(d.liveness,false),threshold:count(d.threshold,false),streak:count(d.streak)}}
export async function legacyRewardStatus(){const r=await read('/api/activity/is-collected-liveness');if(r.code!==0||typeof r.isCollectedYesterdayLivenessReward!=='boolean')throw bad();return{claimed:r.isCollectedYesterdayLivenessReward}}
/** Legacy GET mutates the ledger. Call only after explicit user confirmation; never from refresh/prefetch. */
export async function legacyClaimReward(){const r=await read('/activity/yesterday-liveness-reward-api',true);if(typeof r.sum!=='number'||!Number.isSafeInteger(r.sum)||r.sum!==-1&&r.sum<=0)throw bad();return{amount:r.sum===-1?null:r.sum,awarded:r.sum>0}}
