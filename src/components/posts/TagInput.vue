<script setup lang="ts">
import { nextTick,onBeforeUnmount,onMounted,ref,useId,watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { tagSuggestions,validTagPrefix } from '@/api/v3-tag-suggestions'
import { tagContext,replaceTag,type TagContext } from '@/utils/tagInput'
const props=withDefaults(defineProps<{modelValue:string;disabled?:boolean}>(),{disabled:false})
const emit=defineEmits<{'update:modelValue':[value:string]}>()
const {accessToken,account}=storeToRefs(useAuthStore()),menuId=useId()
const input=ref<HTMLInputElement|null>(null),rows=ref<string[]>([]),open=ref(false),loading=ref(false),error=ref(''),active=ref(-1)
let mounted=false,focused=false,composing=false,sequence=0,timer:ReturnType<typeof setTimeout>|null=null,controller:AbortController|null=null,context:TagContext|null=null,ownValue=props.modelValue
const identity=()=>JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||''])
function close(){sequence++;if(timer!==null)clearTimeout(timer);timer=null;controller?.abort();controller=null;rows.value=[];open.value=false;loading.value=false;error.value='';active.value=-1;context=null}
function refresh(){
 close()
 if(!mounted||!focused||composing||props.disabled||!accessToken.value||!account.value?.oId||!input.value)return
 const current=tagContext(input.value.value,input.value.selectionStart??0,input.value.selectionEnd??0)
 if(!current)return
 if(!validTagPrefix(current.prefix)){error.value='当前标签无法联想，可继续手动输入';return}
 context=current;const reader=identity(),run=sequence;open.value=true;loading.value=true
 timer=setTimeout(async()=>{
  timer=null;const abort=new AbortController();controller=abort
  const valid=()=>mounted&&focused&&!composing&&sequence===run&&reader===identity()&&!abort.signal.aborted&&props.modelValue===current.value
  try{const result=await tagSuggestions(current.prefix,abort.signal);if(valid())rows.value=result}
  catch{if(valid())error.value='标签联想暂不可用，可继续手动输入'}
  finally{if(valid()){loading.value=false;if(controller===abort)controller=null}}
 },200)
}
function focusedInput(){focused=true;refresh()}
function blurredInput(){focused=false;close()}
function compositionStart(){composing=true;close()}
function compositionEnd(){composing=false;refresh()}
function changed(event:Event){const element=event.target as HTMLInputElement;ownValue=element.value;emit('update:modelValue',element.value);refresh()}
async function choose(title:string){
 const saved=context,reader=identity()
 if(props.disabled||!open.value||loading.value||!rows.value.includes(title)||!saved||saved.value!==props.modelValue||!input.value||saved.selectionStart!==input.value.selectionStart||saved.selectionEnd!==input.value.selectionEnd)return
 const next=replaceTag(saved,title);ownValue=next.value;emit('update:modelValue',next.value);close();await nextTick()
 if(mounted&&reader===identity()){input.value?.focus();input.value?.setSelectionRange(next.caret,next.caret)}
}
function keydown(event:KeyboardEvent){
 if(composing||event.isComposing)return
 if(event.key==='Escape'){if(open.value)event.preventDefault();close()}
 else if(event.key==='Tab')close()
 else if(open.value&&rows.value.length&&(event.key==='ArrowDown'||event.key==='ArrowUp')){event.preventDefault();active.value=(active.value+(event.key==='ArrowDown'?1:active.value<0?0:-1)+rows.value.length)%rows.value.length}
 else if(event.key==='Enter'&&open.value&&active.value>=0){event.preventDefault();void choose(rows.value[active.value]!)}
}
watch(()=>props.modelValue,value=>{if(value!==ownValue){ownValue=value;close()}},{flush:'sync'})
watch(identity,close,{flush:'sync'})
watch(()=>props.disabled,value=>{if(value)close()})
onMounted(()=>{mounted=true})
onBeforeUnmount(()=>{mounted=false;close()})
</script>
<template>
 <div class="tag-input">
  <label>标签（逗号分隔）
   <input ref="input" :value="modelValue" :disabled="disabled" required placeholder="前端,摸鱼" role="combobox" aria-autocomplete="list" :aria-expanded="open" :aria-controls="menuId" :aria-activedescendant="active>=0?`${menuId}-${active}`:undefined"
    @focus="focusedInput" @blur="blurredInput" @click="refresh" @input="changed" @keydown="keydown" @keyup="event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key))refresh()}" @compositionstart="compositionStart" @compositionend="compositionEnd" />
  </label>
  <p v-if="loading" role="status">正在查找标签…</p><p v-if="error" role="status">{{ error }}</p>
  <ul v-if="open&&rows.length" :id="menuId" role="listbox" aria-label="标签建议">
   <li v-for="(title,index) in rows" :key="title" role="presentation"><button :id="`${menuId}-${index}`" type="button" role="option" :aria-selected="index===active" tabindex="-1" @pointerdown.prevent @click="choose(title)">{{ title }}</button></li>
  </ul>
 </div>
</template>
<style scoped lang="scss">
.tag-input {display:flex;flex-direction:column;gap:6px;min-width:0;}
label {display:flex;flex-direction:column;gap:6px;}
input {box-sizing:border-box;width:100%;border:1px solid var(--fp-border);border-radius:6px;background:var(--fp-bg);color:var(--fp-text);padding:10px;}
ul {display:flex;gap:6px;flex-wrap:wrap;margin:0;padding:0;list-style:none;}
button {border:1px solid var(--fp-border);border-radius:6px;background:var(--fp-bg);color:var(--fp-text);padding:4px 8px;cursor:pointer;}
button[aria-selected='true'] {outline:2px solid var(--fp-primary, #59945c);}
p {margin:0;font-size:13px;color:var(--fp-muted);}
</style>
