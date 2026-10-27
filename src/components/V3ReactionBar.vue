<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { readReactions, type ReactionState, type ReactionTarget } from '@/api/v3-reactions'
import { useAuthStore } from '@/stores/auth'
import { useV3ReactionsStore } from '@/stores/v3Reactions'
const props=withDefaults(defineProps<{kind:ReactionTarget;targetId:string;readonly?:boolean}>(),{readonly:false})
const {accessToken,account,initialized}=storeToRefs(useAuthStore()),operations=useV3ReactionsStore()
const mounted=ref(false),state=ref<ReactionState|null>(null),loading=ref(false),error=ref(''),open=ref(false)
const authenticated=computed(()=>mounted.value&&!!accessToken.value&&!!account.value)
const readable=computed(()=>mounted.value&&(initialized.value||authenticated.value)&&(props.kind!=='chat'||authenticated.value))
const writable=computed(()=>authenticated.value&&!props.readonly)
const pending=computed(()=>operations.commands[props.kind+':'+props.targetId])
const blocked=computed(()=>loading.value||!!pending.value)
let sequence=0,boundary=''
function identity(){return `${getAuthContextVersion()}:${!!accessToken.value}:${account.value?.oId||''}:${props.kind}:${props.targetId}`}
function clear(keepState=false){sequence++;if(!keepState)state.value=null;loading.value=false;error.value='';if(!keepState)open.value=false}
async function load(confirmed=false){
  if(!readable.value)return
  const current=++sequence,reader=identity(),kind=props.kind,id=props.targetId
  const valid=()=>mounted.value&&readable.value&&current===sequence&&reader===identity()
  loading.value=true;error.value=''
  try{const options=await operations.loadOptions();if(!valid())return;const result=await readReactions(kind,id,options);if(valid()){if(!authenticated.value&&result.currentUserReaction)throw Error('游客表态状态不正确');state.value=result}}
  catch(reason){if(valid()){state.value=null;error.value=(confirmed?'操作已确认，读取当前表态失败：':'')+(reason instanceof Error?reason.message:'表态读取失败')}}
  finally{if(valid())loading.value=false}
}
async function choose(value:string){
  if(!writable.value||blocked.value||!state.value||!operations.options.some(o=>o.value===value))return
  const reader=identity(),choice=state.value.currentUserReaction===value?null:value
  error.value=''
  try{await operations.set(props.kind,props.targetId,choice)}catch(reason){if(mounted.value&&reader===identity())error.value=reason instanceof Error?reason.message:'表态失败'}
}
async function restore(){
  const command=pending.value,reader=identity()
  if(!writable.value||!command||command.busy)return
  error.value=''
  try{await operations.set(props.kind,props.targetId,command.choice)}catch(reason){if(mounted.value&&reader===identity())error.value=reason instanceof Error?reason.message:'表态恢复失败'}
}
watch([accessToken,()=>account.value?.oId,()=>props.kind,()=>props.targetId],()=>{const next=identity();if(next===boundary)return;boundary=next;clear();if(authenticated.value)void load()},{flush:'sync'})
watch(()=>operations.lastChange,change=>{if(change.kind===props.kind&&change.id===props.targetId){if(authenticated.value){clear(true);void load(change.confirmed)}else clear()}},{flush:'sync'})
onMounted(()=>{mounted.value=true;boundary=identity();if(authenticated.value)void load()})
onBeforeUnmount(()=>{mounted.value=false;clear()})
</script>
<template>
  <section v-if="kind!=='chat'||authenticated" class="v3-reactions" :aria-label="`${kind==='article'?'文章':kind==='comment'?'评论':'消息'}表态`">
    <button v-if="readable&&!authenticated&&!loading&&!error" type="button" @click="load()">{{ state?'刷新表态':'查看表态' }}</button>
    <p v-if="loading" role="status">正在读取表态…</p>
    <div v-if="state" class="rx">
      <template v-for="item in state.summary" :key="item.value">
        <button v-if="writable" type="button" class="chip" :title="item.users.join(', ')" :aria-pressed="item.selected" :aria-disabled="blocked" :aria-busy="loading||!!pending?.busy" @click="choose(item.value)">{{ item.emoji }} {{ item.count }}</button>
        <span v-else class="chip" :title="item.users.join(', ')">{{ item.emoji }} {{ item.count }}</span>
      </template>
      <button v-if="writable" type="button" class="ghost" :aria-expanded="open" @click="open=!open">{{ open?'收起表情':'添加表情' }}</button>
      <p v-if="!state.summary.length&&!writable">暂无表态</p>
    </div>
    <div v-if="writable&&operations.options.length" v-show="open" class="palette" aria-label="选择表情">
      <button v-for="option in operations.options" :key="option.value" type="button" :title="option.value" :aria-pressed="state?.currentUserReaction===option.value" :aria-disabled="blocked||!state" :aria-busy="loading||!!pending?.busy" @click="choose(option.value)">{{ option.emoji }}</button>
    </div>
    <template v-if="writable&&pending"><button type="button" :aria-disabled="pending.busy" @click="restore()">{{ pending.busy?'正在提交…':'恢复本次表态' }}</button><p v-if="!pending.busy">操作结果待确认，请恢复同一次操作；刷新页面或退出会清除本地恢复信息。</p></template>
    <p v-if="error||pending?.error" role="alert">{{ error||pending?.error }}</p>
    <button v-if="readable&&!loading&&error" type="button" @click="load()">重读当前表态</button>
  </section>
</template>
<style scoped lang="scss">
.v3-reactions { max-width: 100%; min-width: 0; overflow-wrap: anywhere; p { margin: 4px 0; } [role='alert'] { color: #c34a36; } }
.rx, .palette { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
button, .chip { border: 1px solid var(--fp-border); background: transparent; color: var(--fp-text); border-radius: 12px; padding: 3px 8px; font-size: 12px; }
button { cursor: pointer; &[aria-disabled='true'] { opacity: .5; cursor: default; } &[aria-pressed='true'] { border-color: var(--fp-primary); color: var(--fp-link); } }
.palette { margin: 6px 0; padding: 4px 0; }
</style>
