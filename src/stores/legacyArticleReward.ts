import {defineStore} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {getApiMode} from '@/api/mode'
import {legacyRewardId,readLegacyArticleReward,purchaseLegacyArticleReward} from '@/api/legacy/article-reward'
import {fpConfirm} from '@/composables/useDialog'
import {useAuthStore} from './auth'
type Pending={id:string;price:number}
export const useLegacyArticleRewardStore=defineStore('legacy-article-reward',()=>{
 const auth=useAuthStore(),pending=ref<Pending|null>(null),busy=ref(false),error=ref(''),errorId=ref(''),followupError=ref(''),lastChange=ref({id:'',revision:0});let generation=0,confirmation:AbortController|null=null
 const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId]),active=()=>!import.meta.env.SSR&&getApiMode()==='v1'&&!!auth.apiKey&&!!auth.account?.oId
 function clear(){generation++;confirmation?.abort();confirmation=null;pending.value=null;busy.value=false;error.value=errorId.value=followupError.value='';lastChange.value={id:'',revision:lastChange.value.revision+1}}
 const stop=watch(identity,clear,{flush:'sync'});onScopeDispose(()=>{stop();clear()})
 async function purchase(id:string,signal?:AbortSignal){
  if(!active()||busy.value||pending.value)return
  legacyRewardId(id);const actor=identity(),run=generation,valid=()=>active()&&run===generation&&actor===identity(),controller=new AbortController(),abort=()=>controller.abort();confirmation=controller
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()
  busy.value=true;error.value=followupError.value='';errorId.value=id;let sent=false
  try{controller.signal.throwIfAborted();const current=await readLegacyArticleReward(id,controller.signal);if(!valid()||controller.signal.aborted)return
   if(current.rewarded){lastChange.value={id,revision:lastChange.value.revision+1};return}
   if(current.price<1)throw new Error('当前文章未启用打赏，请重新读取文章。')
   if(current.anonymous)throw new Error('旧详情未提供匿名文章的实际解锁费用，当前暂不提供购买。')
   const yes=await fpConfirm({title:'确认文章打赏',message:`当前价格 ${current.price} 积分。确认后会再次核对价格；旧接口不支持价格锁定，平台按提交时价格结算。结果未知时不能自动重发，是否继续？`,confirmText:'确认打赏',signal:controller.signal})
   if(!yes||!valid()||controller.signal.aborted)return
   const latest=await readLegacyArticleReward(id,controller.signal);if(!valid()||controller.signal.aborted)return
   if(latest.rewarded){lastChange.value={id,revision:lastChange.value.revision+1};return}
   if(latest.anonymous||latest.price!==current.price||latest.price<1)throw new Error('打赏价格或文章状态已变化，尚未提交。请重新读取并确认。')
   pending.value={id,price:latest.price};sent=true
   await purchaseLegacyArticleReward(id);if(!valid())return
   pending.value=null;lastChange.value={id,revision:lastChange.value.revision+1}
   void auth.reloadAccount().catch(()=>{if(valid())followupError.value='打赏请求已确认，积分余额刷新失败；请只重读余额，不要重复购买。'})
  }catch(e){if(valid()&&(!controller.signal.aborted||sent))error.value=sent?'打赏结果未确认，请核对当前解锁状态和积分流水，不能自动重发。':e instanceof Error?e.message:'打赏操作失败'}
  finally{signal?.removeEventListener('abort',abort);if(confirmation===controller)confirmation=null;if(valid())busy.value=false}
 }
 async function release(){if(!active()||busy.value||!pending.value)return;const actor=identity(),run=generation,original=pending.value,id=original.id,controller=new AbortController();confirmation=controller;busy.value=true
  try{const yes=await fpConfirm({title:'核对未知打赏',message:`确认已核对文章 ${id} 的解锁状态和积分流水？解除只清除本机锁定，不会重发原购买；再次购买仍需重新读取和确认。`,confirmText:'已核对，解除锁定',signal:controller.signal});if(yes&&!controller.signal.aborted&&actor===identity()&&run===generation&&pending.value===original){pending.value=null;error.value='';lastChange.value={id,revision:lastChange.value.revision+1}}}catch{if(actor===identity()&&run===generation&&!controller.signal.aborted)error.value='解除锁定失败，请先保留原记录并重试。'}finally{if(confirmation===controller)confirmation=null;if(actor===identity()&&run===generation)busy.value=false}
 }
 return{pending,busy,error,errorId,followupError,lastChange,purchase,release}
})
