<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import type {ReactionState,ReactionTarget} from '@/api/v3-reactions'
import {LEGACY_REACTION_OPTIONS,type LegacyReactionSource} from '@/api/legacy/reactions'
import {useChatStore} from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import {useLegacyReactionsStore} from '@/stores/legacyReactions'
const props=withDefaults(defineProps<{kind:ReactionTarget;targetId:string;readonly?:boolean;source?:LegacyReactionSource}>(),{readonly:false})
const {apiKey,account,initialized}=storeToRefs(useAuthStore()),operations=useLegacyReactionsStore(),chat=props.kind==='chat'?useChatStore():null
const mounted=ref(false),state=ref<ReactionState|null>(null),loading=ref(false),error=ref(''),open=ref(false)
const authenticated=computed(()=>mounted.value&&!!apiKey.value&&!!account.value)
const readable=computed(()=>mounted.value&&(initialized.value||authenticated.value)&&(props.kind!=='chat'||authenticated.value))
const writable=computed(()=>authenticated.value&&!props.readonly)
const pending=computed(()=>operations.commands[props.kind+':'+props.targetId])
const blocked=computed(()=>loading.value||!!pending.value)
let sequence=0,boundary=''
function identity(){return `${getAuthContextVersion()}:${apiKey.value||''}:${account.value?.oId||''}:${props.kind}:${props.targetId}:${JSON.stringify(props.source||{})}`}
function clear(keepState=false){sequence++;if(!keepState)state.value=null;loading.value=false;error.value='';if(!keepState)open.value=false}
async function load(confirmed=false){
  if(!readable.value)return
  const current=++sequence,reader=identity(),kind=props.kind,id=props.targetId
  const valid=()=>mounted.value&&readable.value&&current===sequence&&reader===identity()
  loading.value=true;error.value=''
  try{const result=await operations.read(kind,id,props.source);if(valid()){if(!authenticated.value&&result.currentUserReaction)throw Error('游客表态状态不正确');state.value=result}}
  catch(reason){if(valid()){state.value=null;error.value=(confirmed?'操作已确认，读取当前表态失败：':'')+(reason instanceof Error?reason.message:'表态读取失败')}}
  finally{if(valid())loading.value=false}
}
async function choose(value:string){
  if(!writable.value||blocked.value||!state.value||!LEGACY_REACTION_OPTIONS.some(o=>o.value===value))return
  const reader=identity()
  error.value=''
  try{await operations.toggle(props.kind,props.targetId,value)}catch(reason){if(mounted.value&&reader===identity())error.value=reason instanceof Error?reason.message:'表态失败'}
}
watch([apiKey,()=>account.value?.oId,()=>props.kind,()=>props.targetId,()=>JSON.stringify(props.source||{})],()=>{const next=identity();if(next===boundary)return;boundary=next;clear();if(authenticated.value)void load()},{flush:'sync'})
watch(()=>operations.lastChange,change=>{if(change.kind===props.kind&&change.id===props.targetId){if(authenticated.value){clear(true);void load(change.confirmed)}else clear()}},{flush:'sync'})
watch(()=>chat?.changeHint,hint=>{if(hint&&(!hint.id||hint.id===props.targetId)&&authenticated.value){clear(true);void load()}},{flush:'sync'})
function focus(){if(state.value||authenticated.value)void load()}
onMounted(()=>{mounted.value=true;boundary=identity();window.addEventListener('focus',focus);if(authenticated.value)void load()})
onBeforeUnmount(()=>{window.removeEventListener('focus',focus);mounted.value=false;clear()})
</script>
<template>
  <section v-if="kind!=='chat'||authenticated" class="v3-reactions" :class="`kind-${kind}`" :aria-label="`${kind==='article'?'文章':kind==='comment'?'评论':'消息'}表态`">
    <button v-if="readable&&!authenticated&&!loading&&!error" type="button" class="guest-rx-btn" :class="{'is-refresh':!!state}" @click="load()">{{ state?'刷新表态':'查看表态' }}</button>
    <p v-if="loading" class="rx-loading" role="status">正在读取表态…</p>
    <div v-if="state" class="rx">
      <template v-for="item in state.summary" :key="item.value">
        <button v-if="writable" type="button" class="chip" :title="item.users.join(', ')" :aria-pressed="item.selected" :aria-disabled="blocked" :aria-busy="loading||!!pending?.busy" @click="choose(item.value)">{{ item.emoji }} {{ item.count }}</button>
        <span v-else class="chip" :title="item.users.join(', ')">{{ item.emoji }} {{ item.count }}</span>
      </template>
      <button v-if="writable" type="button" class="ghost" :aria-expanded="open" @click="open=!open">{{ open?'收起表情':'添加表情' }}</button>
      <p v-if="!state.summary.length&&!writable" class="rx-empty">暂无表态</p>
    </div>
    <div v-if="writable&&LEGACY_REACTION_OPTIONS.length" v-show="open" class="palette" aria-label="选择表情">
      <button v-for="option in LEGACY_REACTION_OPTIONS" :key="option.value" type="button" :title="option.value" :aria-pressed="state?.currentUserReaction===option.value" :aria-disabled="blocked||!state" :aria-busy="loading||!!pending?.busy" @click="choose(option.value)">{{ option.emoji }}</button>
    </div>
    <template v-if="writable&&pending"><p role="status">{{ pending.busy?'正在提交…':'旧接口为切换操作，结果未确认时不能重发。' }}</p><button type="button" :aria-disabled="pending.busy||loading" @click="!pending.busy&&!loading&&load()">重读当前表态核对</button><button type="button" :aria-disabled="pending.busy||loading||!pending.verified||!state||!!error" @click="!pending.busy&&!loading&&pending.verified&&state&&!error&&operations.release(kind,targetId)">我已核对，解除锁定</button></template>
    <p v-if="error||pending?.error" role="alert">{{ error||pending?.error }}</p>
    <button v-if="readable&&!loading&&error" type="button" @click="load()">重读当前表态</button>
  </section>
</template>
<style scoped lang="scss">
.v3-reactions { max-width: 100%; min-width: 0; overflow-wrap: anywhere; p { margin: 4px 0; font-size: 12px; } .rx-loading, .rx-empty, .guest-rx-btn.is-refresh { display: none !important; } [role='alert'] { color: #c34a36; } }
.rx, .palette { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; }
button, .chip { display: inline-flex; align-items: center; gap: 3px; border: 1px solid var(--fp-border); background: transparent; color: var(--fp-text); border-radius: 999px; height: 24px; padding: 0 8px; font-size: 12px; transition: background-color .14s, border-color .14s, color .14s; }
.ghost { border: 0; color: var(--fp-muted); padding: 0 7px; &::before { content: '😊'; font-size: 12px; opacity: .85; } &:hover { background: var(--fp-hover); color: var(--fp-title); } }
.kind-article .ghost { border: 1px dashed var(--fp-border); padding: 0 9px; }
button { cursor: pointer; &:hover:not([aria-disabled='true']) { background: var(--fp-hover); } &[aria-disabled='true'] { opacity: .5; cursor: default; } &[aria-pressed='true'] { border-color: var(--fp-primary); color: var(--fp-primary); background: var(--fp-primary-soft, rgba(105, 170, 105, 0.12)); } }
.palette { margin: 4px 0; padding: 4px 6px; border: 1px solid var(--fp-border); border-radius: 10px; background: var(--fp-card); }
</style>
