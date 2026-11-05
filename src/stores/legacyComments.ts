import {defineStore} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {getApiMode} from '@/api/mode'
import {commentInput,type CommentCommand,type CommentInput} from '@/api/v3-comments'
import {legacyCreateComment,legacyRemoveComment} from '@/api/legacy/comments'
import {fpConfirm} from '@/composables/useDialog'
import {useAuthStore} from './auth'
export const useLegacyCommentsStore=defineStore('legacy-comments',()=>{
 const auth=useAuthStore(),pending=ref<CommentCommand|null>(null),completed=ref<CommentCommand|null>(null),receipt=ref<{articleId:string;id?:string;operation:string}|null>(null),busy=ref(false),confirming=ref(false),error=ref(''),message=ref(''),revision=ref(0),lastOperation=ref('');let generation=0,localSequence=0,confirmation:AbortController|undefined,confirmationOwner:symbol|undefined
 const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId]),active=()=>!import.meta.env.SSR&&getApiMode()==='v1'&&!!auth.apiKey&&!!auth.account?.oId
 function reset(){generation++;confirmation?.abort();confirmation=undefined;confirmationOwner=undefined;pending.value=completed.value=null;receipt.value=null;busy.value=confirming.value=false;error.value=message.value='';revision.value++}
 const stop=watch(identity,reset,{flush:'sync'});onScopeDispose(()=>{stop();reset()})
 function capture(){const actor=identity(),run=generation;return()=>active()&&actor===identity()&&run===generation}
 async function save(articleId:string,value:CommentInput,id='',origin?:symbol){
  if(pending.value||busy.value||confirming.value||!active())return false
  if(id){error.value='旧接口的原文读取仍依赖页面会话，暂不能安全编辑评论。';return false}
  if(!/^[1-9][0-9]{0,31}$/.test(articleId))throw new ApiError('文章ID不合法',422)
  const input=commentInput('create',value),valid=capture();error.value=message.value='';confirming.value=true;confirmation=new AbortController();confirmationOwner=origin
  try{const accepted=await fpConfirm({title:input.paragraphId?'发布段评确认':'发布评论确认',message:'按平台评论费用、匿名资格及审核规则发布。旧接口不支持幂等恢复，结果未确认时请勿重复提交。',confirmText:'发表评论',signal:confirmation.signal});if(!accepted||!valid()||confirmation?.signal.aborted)return false
   // key correlates this local UI draft only; it is never an idempotency claim or sent upstream.
   const command:CommentCommand={operation:'create',articleId,id:'',input:{...input},key:'local-comment-'+(++localSequence)};pending.value=command;busy.value=true
   try{const result=await legacyCreateComment(articleId,input);if(!valid())return false;completed.value=command;receipt.value={articleId,operation:'create',...(result.id?{id:result.id}:{})};pending.value=null;lastOperation.value='create';message.value='发布已确认，请以重新读取的评论为准。';revision.value++;try{await auth.reloadAccount()}catch{if(valid())message.value='发布已确认，本人资料刷新失败，请另行核对。'}return true}
   catch(e){if(valid()){error.value=e instanceof Error?e.message:'发布失败';if(e instanceof ApiError&&[401,403,422].includes(e.status))pending.value=null;else error.value='发布结果未确认，旧接口不支持幂等恢复，请先核对原评论，不要重复提交。'}return false}
  }finally{if(valid()){busy.value=confirming.value=false;confirmation=undefined;confirmationOwner=undefined}}
 }
 function release(){if(busy.value||confirming.value)return;pending.value=null;error.value=''}
 function cancelConfirmation(origin:symbol){if(confirmationOwner===origin)confirmation?.abort()}
 async function remove(articleId:string,id:string,origin?:symbol){
  if(pending.value||busy.value||confirming.value||!active())return false
  if(!/^[1-9][0-9]{0,31}$/.test(articleId)||!/^[1-9][0-9]{0,31}$/.test(id))throw new ApiError('评论目标不合法',422)
  const valid=capture();error.value=message.value='';confirming.value=true;confirmation=new AbortController();confirmationOwner=origin
  try{
   const accepted=await fpConfirm({title:'删除评论',message:'删除不可恢复，并按平台当前删除费用扣除积分。旧接口不提供金额预览或幂等恢复；结果未确认时请先核对，不能重复提交。是否继续？',confirmText:'删除',tone:'danger',signal:confirmation.signal})
   if(!accepted||!valid()||confirmation?.signal.aborted)return false
   const command:CommentCommand={operation:'delete',articleId,id,input:{content:''},key:'local-comment-'+(++localSequence)}
   pending.value=command;busy.value=true
   try{const result=await legacyRemoveComment(articleId,id);if(!valid())return false;completed.value=command;receipt.value={articleId,id:result.id,operation:'delete'};pending.value=null;lastOperation.value='delete';message.value='删除已确认，请以重新读取的评论为准。';revision.value++;try{await auth.reloadAccount()}catch{if(valid())message.value='删除已确认，余额刷新失败，请另行核对。'}return true}
   catch(failure){if(valid())error.value=(failure instanceof Error?failure.message:'删除未确认')+'。删除结果未确认，请核对原评论；旧接口不支持幂等恢复，不要重复提交。';return false}
  }finally{if(valid()){busy.value=confirming.value=false;confirmation=undefined;confirmationOwner=undefined}}
 }
 return{pending,completed,receipt,busy,confirming,error,message,revision,lastOperation,capture,save,remove,release,cancelConfirmation}
})
