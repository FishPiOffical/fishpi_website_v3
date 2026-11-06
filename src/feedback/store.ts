import { defineStore } from 'pinia'
import { onScopeDispose, reactive, ref } from 'vue'
import { FeedbackError, feedbackApi, ensureFeedbackVisitor, getFeedbackContextVersion, onFeedbackIdentityChange } from './api'
type Command = { path:string; method:string; body:unknown; key:string }
export const useFeedbackStore = defineStore('feedback',()=>{
  const draft=reactive({ title:'', category:'feature', description:'', displayName:'' })
  const pending=ref<Command|null>(null), busy=ref(false), result=ref<{id:string}|null>(null)
  let context=getFeedbackContextVersion(), generation=0
  const off=onFeedbackIdentityChange(()=>{
    if(context!==getFeedbackContextVersion()) { context=getFeedbackContextVersion(); generation++; pending.value=null; result.value=null; busy.value=false }
  })
  onScopeDispose(off)
  async function run(command?: Omit<Command,'key'>) {
    if(busy.value) return null
    await ensureFeedbackVisitor()
    if(busy.value) return null
    if(!pending.value) { if(!command) return null; pending.value={...command,body:JSON.parse(JSON.stringify(command.body)),key:crypto.randomUUID()} }
    const frozen=pending.value, version=generation
    busy.value=true
    try {
      const value=await feedbackApi<{id:string}>(frozen.path,{method:frozen.method,body:frozen.body,key:frozen.key,private:true})
      if(version!==generation) return null
      result.value=value; pending.value=null
      if(frozen.method==='POST') Object.assign(draft,{title:'',category:'feature',description:''})
      return value
    } catch(e) {
      // 422 is validated before any command can commit; let the user correct it.
      if(version===generation && e instanceof FeedbackError && e.status===422) pending.value=null
      throw e
    } finally { if(version===generation) busy.value=false }
  }
  function acknowledge() { result.value=null }
  return {draft,pending,busy,result,run,acknowledge}
})
