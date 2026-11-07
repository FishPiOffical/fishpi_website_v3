import { defineStore, storeToRefs } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { profileOperationKey } from '@/api/v3-profile'
import { readChatAppearance, setChatAppearance, type AppearanceCommand } from '@/api/v3-chat-appearance'
import { isChatAppearance, type ChatAppearance } from '@/utils/chatAppearance'
import { useAuthStore } from '@/stores/auth'

export const useV3ChatAppearanceStore = defineStore('v3-chat-appearance', () => {
  const {accessToken,account}=storeToRefs(useAuthStore())
  const current=ref<ChatAppearance|null>(null),pending=ref<AppearanceCommand|null>(null),loading=ref(false),busy=ref(false),error=ref(''),writeError=ref('')
  let generation=0,sequence=0,boundary=getAuthContextVersion(),owner=account.value?.oId,wanted=false,abort:AbortController|null=null
  const active=()=>!import.meta.env.SSR&&!!accessToken.value&&!!account.value?.oId
  const capture=()=>{const epoch=generation,context=getAuthContextVersion(),actor=account.value?.oId;return()=>active()&&epoch===generation&&context===getAuthContextVersion()&&actor===account.value?.oId}
  function cancelRead(){sequence++;abort?.abort();abort=null;loading.value=false}
  function clear(){generation++;cancelRead();current.value=null;pending.value=null;busy.value=false;error.value=writeError.value=''}
  async function load(){
    wanted=true;if(!active()||loading.value)return
    const valid=capture(),run=++sequence,controller=new AbortController();abort=controller;loading.value=true;error.value=''
    try{const result=await readChatAppearance(controller.signal);if(valid()&&run===sequence&&!controller.signal.aborted)current.value=result}
    catch(e){if(valid()&&run===sequence&&!controller.signal.aborted){current.value=null;error.value=e instanceof Error?e.message:'聊天外观读取失败'}}
    finally{if(valid()&&run===sequence){loading.value=false;abort=null}}
  }
  async function execute(command:AppearanceCommand,recovering:boolean){
    if(!active()||busy.value)return
    const valid=capture();cancelRead();pending.value=command;busy.value=true;writeError.value=''
    try{await setChatAppearance(command);if(valid()){pending.value=null;current.value=null;await load()}}
    catch(e){if(valid()){writeError.value=e instanceof Error?e.message:'聊天外观保存失败';if(!recovering&&e instanceof ApiError&&e.status>=400&&e.status<500&&e.code!=='confirmation_required')pending.value=null}}
    finally{if(valid())busy.value=false}
  }
  function choose(kind:'bubble'|'frame',id:string){
    if(!current.value||pending.value||busy.value||loading.value)return
    const input={...current.value,[kind==='bubble'?'bubbleId':'frameId']:id}
    if(!isChatAppearance(input)){writeError.value='当前客户端不支持此样式';return}
    if(input.bubbleId===current.value.bubbleId&&input.frameId===current.value.frameId)return
    return execute({bubbleId:input.bubbleId,frameId:input.frameId,key:profileOperationKey()},false)
  }
  function ensure(){wanted=true;if(!current.value&&!loading.value&&!busy.value)void load()}
  function retry(){if(pending.value&&!busy.value)return execute(pending.value,true)}
  const stop=watch([accessToken,()=>account.value?.oId],()=>{const context=getAuthContextVersion(),actor=account.value?.oId;if(!accessToken.value||context!==boundary||actor!==owner)clear();boundary=context;owner=actor;if(wanted&&active()&&!busy.value)void load()},{flush:'sync'})
  onScopeDispose(()=>{stop();clear()})
  return{current,pending,loading,busy,error,writeError,ensure,load,choose,retry}
})
