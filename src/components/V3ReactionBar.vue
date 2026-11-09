<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { readReactions, type ReactionState, type ReactionTarget } from '@/api/v3-reactions'
import { useAuthStore } from '@/stores/auth'
import { useV3ReactionsStore } from '@/stores/v3Reactions'
const props=withDefaults(defineProps<{kind:ReactionTarget;targetId:string;readonly?:boolean;initialReadStarted?: number; initialState?:ReactionState|null}>(),{readonly:false})
const {accessToken,account,initialized}=storeToRefs(useAuthStore()),operations=useV3ReactionsStore()
const mounted=ref(false),state=ref<ReactionState|null>(null),loading=ref(false),error=ref(''),open=ref(false)
const root=ref<HTMLElement|null>(null),trigger=ref<HTMLButtonElement|null>(null)
const palette=ref<HTMLElement|null>(null)
const paletteStyle=ref<Record<string,string>>({})
function close(focus=false){open.value=false;if(focus)trigger.value?.focus?.()}
function outside(event:Event){if(open.value&&event.target instanceof Node&&!root.value?.contains(event.target)&&!palette.value?.contains(event.target))close()}
function escape(event:KeyboardEvent){if(open.value&&event.key==='Escape'){event.preventDefault();close(true)}}
function togglePalette(){
  if(open.value){close();return}
  if (blocked.value || !state.value) return
  if (!operations.options.length && props.initialState !== undefined) {
    const reader = identity()
    void operations.loadOptions().then(() => {
      if (mounted.value && reader === identity() && !open.value) togglePalette()
    }).catch(() => {
      if (mounted.value && reader === identity()) error.value = '表情目录读取失败，请重试'
    })
    return
  }
  open.value=true
  void nextTick(()=>{
    const rect=root.value?.getBoundingClientRect?.()
    if(!rect||typeof window==='undefined')return
    const width=Math.min(248,window.innerWidth-32)
    const left=Math.max(16,Math.min(rect.left,window.innerWidth-width-16))
    const height=palette.value?.getBoundingClientRect().height||180
    const top=Math.max(8,Math.min(rect.top>height+12?rect.top-height-8:rect.bottom+8,window.innerHeight-height-8))
    paletteStyle.value={left:`${left}px`,top:`${top}px`}
  })
}
function scrollOutside(event:Event){if(open.value&&!(event.target instanceof Node&&palette.value?.contains(event.target)))close()}
function resize(){close()}
const authenticated=computed(()=>mounted.value&&!!accessToken.value&&!!account.value)
const readable=computed(()=>mounted.value&&(initialized.value||authenticated.value)&&(props.kind!=='chat'||authenticated.value))
const writable=computed(()=>authenticated.value&&!props.readonly)
const pending=computed(()=>operations.commands[props.kind+':'+props.targetId])
const blocked=computed(()=>loading.value||!!pending.value)
let sequence=0,boundary=''
let lastReceiptAt = -1
function identity(){return `${getAuthContextVersion()}:${!!accessToken.value}:${account.value?.oId||''}:${props.kind}:${props.targetId}`}
function clear(keepState=false){sequence++;if(!keepState)state.value=null;loading.value=false;error.value='';if(!keepState)open.value=false}
async function load(confirmed=false){
  if(!readable.value)return
  const current=++sequence,reader=identity(),kind=props.kind,id=props.targetId
  const valid=()=>mounted.value&&readable.value&&current===sequence&&reader===identity()
  loading.value=true;error.value=''
  try {
    let result
    if (kind !== 'chat') {
      result = await operations.readContent(kind, id)
    } else {
      const options = await operations.loadOptions()
      if (!valid()) return
      result = await readReactions(kind, id, options)
    }
    if (valid()) {
      if (!authenticated.value && result.currentUserReaction) throw Error('游客表态状态不正确')
      state.value = result
    }
  }
  catch(reason){if(valid()){state.value=null;error.value=(confirmed?'操作已确认，读取当前表态失败：':'')+(reason instanceof Error?reason.message:'表态读取失败')}}
  finally{if(valid())loading.value=false}
}
async function choose(value:string){
  if(!writable.value||blocked.value||!state.value)return
  const reader=identity()
  if (!operations.options.length && props.initialState !== undefined) {
    try { await operations.loadOptions() }
    catch { if (reader === identity()) error.value = '表情目录读取失败，请重试'; return }
  }
  if (!mounted.value || reader !== identity() || blocked.value || !state.value || !operations.options.some(o=>o.value===value)) return
  const choice=state.value.currentUserReaction===value?null:value
  if(open.value)close(true)
  error.value=''
  try{await operations.set(props.kind,props.targetId,choice)}catch(reason){if(mounted.value&&reader===identity())error.value=reason instanceof Error?reason.message:'表态失败'}
}
async function restore(){
  const command=pending.value,reader=identity()
  if(!writable.value||!command||command.busy)return
  error.value=''
  try{await operations.set(props.kind,props.targetId,command.choice)}catch(reason){if(mounted.value&&reader===identity())error.value=reason instanceof Error?reason.message:'表态恢复失败'}
}
watch([accessToken,()=>account.value?.oId,()=>props.kind,()=>props.targetId],()=>{const next=identity();if(next===boundary)return;boundary=next;lastReceiptAt=-1;clear();if(authenticated.value&&props.initialState===undefined)void load()},{flush:'sync'})
watch(()=>operations.lastChange,change=>{if(change.kind===props.kind&&change.id===props.targetId){if(authenticated.value){clear(true);if(change.snapshot!==undefined){lastReceiptAt=performance.now();state.value=change.snapshot;}else void load(change.confirmed)}else clear()}},{flush:'sync'})
watch(() => props.initialState, () => {
  if (props.initialState && (props.initialReadStarted ?? Infinity) <= lastReceiptAt) return
  clear()
  state.value = props.initialState ?? null
  if (authenticated.value && props.initialState === undefined) void load()
})
onMounted(()=>{mounted.value=true;boundary=identity();state.value=props.initialState??null;if(authenticated.value&&props.initialState===undefined)void load();if(typeof document!=='undefined'){document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);document.addEventListener('scroll',scrollOutside,true)}if(typeof window!=='undefined')window.addEventListener?.('resize',resize)})
onBeforeUnmount(()=>{mounted.value=false;clear();if(typeof document!=='undefined'){document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);document.removeEventListener('scroll',scrollOutside,true)}if(typeof window!=='undefined')window.removeEventListener?.('resize',resize)})
</script>
<template>
  <section v-if="kind!=='chat'||authenticated" ref="root" class="v3-reactions" :class="`kind-${kind}`" :aria-label="`${kind==='article'?'文章':kind==='comment'?'评论':'消息'}表态`">
    <button v-if="readable&&!authenticated&&!loading&&!error&&initialState===undefined" type="button" class="guest-rx-btn" :class="{'is-refresh':!!state}" @click="load()">{{ state?'刷新表态':'查看表态' }}</button>
    <p v-if="loading" class="rx-loading" role="status">正在读取表态…</p>
    <div v-if="state || (writable && kind !== 'chat')" class="rx">
      <template v-for="item in state?.summary" :key="item.value">
        <button v-if="writable" type="button" class="chip" :title="item.users.join(', ')" :aria-pressed="item.selected" :aria-disabled="blocked" :aria-busy="loading||!!pending?.busy" @click="choose(item.value)">{{ item.emoji }} {{ item.count }}</button>
        <span v-else class="chip" :title="item.users.join(', ')">{{ item.emoji }} {{ item.count }}</span>
      </template>
      <button v-if="writable" ref="trigger" type="button" class="ghost" :class="{'icon-only':kind==='chat'}" :aria-disabled="blocked || !state" :aria-expanded="open" :aria-label="open?'收起表情':'添加表情'" :title="open?'收起表情':'添加表情'" @click="togglePalette"><span v-if="kind==='chat'" aria-hidden="true">😊</span><template v-else>{{ open?'收起表情':'添加表情' }}</template></button>
      <p v-if="state && !state.summary.length && !writable" class="rx-empty">暂无表态</p>
    </div>
    <Teleport v-if="mounted&&writable&&operations.options.length" to="body"><div ref="palette" v-show="open" class="palette" :style="paletteStyle" aria-label="选择表情">
      <button v-for="option in operations.options" :key="option.value" type="button" :title="option.value" :aria-pressed="state?.currentUserReaction===option.value" :aria-disabled="blocked||!state" :aria-busy="loading||!!pending?.busy" @click="choose(option.value)">{{ option.emoji }}</button>
    </div></Teleport>
    <template v-if="writable&&pending"><button type="button" :aria-disabled="pending.busy" @click="restore()">{{ pending.busy?'正在提交…':'恢复本次表态' }}</button><p v-if="!pending.busy">操作结果待确认，请恢复同一次操作；刷新页面或退出会清除本地恢复信息。</p></template>
    <p v-if="error||pending?.error" role="alert">{{ error||pending?.error }}</p>
    <button v-if="readable&&!loading&&error" type="button" @click="load()">重读当前表态</button>
  </section>
</template>
<style scoped lang="scss">
.v3-reactions { position: relative; max-width: 100%; min-width: 0; overflow-wrap: anywhere; p { margin: 4px 0; font-size: 12px; } .rx-loading, .rx-empty, .guest-rx-btn.is-refresh { display: none !important; } [role='alert'] { color: #c34a36; } }
.rx, .palette { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; }
button, .chip { display: inline-flex; align-items: center; gap: 3px; border: 1px solid var(--fp-border); background: transparent; color: var(--fp-text); border-radius: 999px; height: 22px; padding: 0 6px; font-size: 12px; transition: background-color .14s, border-color .14s, color .14s; }
.ghost { border: 0; color: var(--fp-muted); padding: 0 7px; gap: 5px; &:not(.icon-only)::before { content: '😊'; font-size: 12px; } &:hover { background: var(--fp-hover); color: var(--fp-title); } &.icon-only { width: 24px; height: 24px; padding: 0; justify-content: center; font-size: 14px; } &[aria-expanded='true'] { background: var(--fp-hover); } }
.kind-article .ghost { border: 1px dashed var(--fp-border); padding: 0 9px; }
button { cursor: pointer; &:hover:not([aria-disabled='true']) { background: var(--fp-hover); } &[aria-disabled='true'] { opacity: .5; cursor: default; } &[aria-pressed='true'] { border-color: var(--fp-primary); color: var(--fp-primary); background: var(--fp-primary-soft, rgba(105, 170, 105, 0.12)); } }
.palette { position: fixed; z-index: 1500; width: min(248px, calc(100vw - 32px)); box-sizing: border-box; display: grid; grid-template-columns: repeat(8,minmax(0,1fr)); gap: 2px; max-height: 220px; overflow: auto; padding: 6px; border: 1px solid var(--fp-border); border-radius: 12px; background: var(--fp-card); box-shadow: 0 8px 28px rgba(0,0,0,.1); button { border: 0; border-radius: 7px; height: 26px; padding: 0; justify-content: center; font-size: 17px; cursor: pointer; background: transparent; color: var(--fp-text); &:hover:not([aria-disabled='true']) { background: var(--fp-hover); } &[aria-disabled='true'] { opacity: .5; cursor: default; } &[aria-pressed='true'] { background: var(--fp-primary-soft); } } }
@media(prefers-reduced-motion:no-preference){.palette{animation:palette-appear .14s ease-out}@keyframes palette-appear{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}}
</style>
