<script setup lang="ts">
import { computed,onMounted,onScopeDispose,ref,watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { type LegacyArticleVote } from '@/api/legacy/article-votes'
import { useLegacyArticleVotesStore } from '@/stores/legacyArticleVotes'
const props=defineProps<{articleId:string}>(),auth=useAuthStore(),operations=useLegacyArticleVotesStore(),mounted=ref(false),state=ref<LegacyArticleVote|null>(null),loading=ref(false),error=ref('')
const visible=computed(()=>mounted.value&&!!auth.apiKey&&!!auth.account?.oId),pending=computed(()=>operations.commands[props.articleId])
const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId,props.articleId]);let sequence=0
function clear(){sequence++;state.value=null;loading.value=false;error.value=''}
async function load(){
 if(!visible.value)return
 const reader=identity(),run=++sequence;state.value=null;loading.value=true;error.value=''
 const valid=()=>visible.value&&reader===identity()&&run===sequence
 try{const result=await operations.read(props.articleId);if(valid())state.value=result}catch(failure){if(valid())error.value=failure instanceof Error?failure.message:'文章投票读取失败'}finally{if(valid())loading.value=false}
}
function submit(choice:'up'|'down'){if(!visible.value||loading.value||!state.value||pending.value)return;void operations.set(props.articleId,state.value.vote===choice?null:choice)}
watch(identity,()=>{clear();void load()},{flush:'sync'})
watch(()=>operations.lastChange,change=>{if(change.id===props.articleId){clear();void load()}},{flush:'sync'})
onMounted(()=>{mounted.value=true;void load()})
onScopeDispose(()=>{mounted.value=false;clear()})
</script>
<template><section v-if="visible" class="legacy-article-vote" aria-label="文章投票"><button type="button" class="vote-btn vote-up" :aria-disabled="loading||!!pending||!state" :aria-busy="loading||pending?.busy" :aria-pressed="state?.vote==='up'" @click="submit('up')">{{ state?.vote==='up'?'取消赞同':'赞同' }}<template v-if="state"> · {{ state.upCount }}</template></button><button type="button" class="vote-btn vote-down" :aria-disabled="loading||!!pending||!state" :aria-busy="loading||pending?.busy" :aria-pressed="state?.vote==='down'" @click="submit('down')">{{ state?.vote==='down'?'取消反对':'反对' }}<template v-if="state"> · {{ state.downCount }}</template></button><button type="button" class="reread-btn" :class="{'is-hidden':state&&!error&&!pending&&!operations.errors[articleId]}" :aria-disabled="pending?.busy" @click="!pending?.busy&&load()">重读投票状态</button><p v-if="loading" class="loading-status" role="status">正在读取投票状态…</p><p v-if="error||pending?.error||operations.errors[articleId]" role="alert">{{ error||pending?.error||operations.errors[articleId] }}</p><template v-if="pending&&!pending.busy"><p>旧接口为切换操作，其他设备同时投票仍可能改变结果。核对当前状态后再解除锁定。</p><button type="button" :disabled="!pending.verified||loading||!state||!!error" @click="operations.release(articleId)">我已核对，解除投票锁定</button></template></section></template>
<style scoped>.legacy-article-vote{display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;max-width:100%;overflow-wrap:anywhere}button{display:inline-flex;align-items:center;gap:4px;height:28px;border:1px solid var(--fp-border);border-radius:999px;padding:0 11px;font-size:12.5px;color:var(--fp-text);background:var(--fp-card);cursor:pointer;transition:border-color .15s,background-color .15s,color .15s}button:hover:not([aria-disabled=true]){background:var(--fp-hover)}.vote-up::before{content:'▲';font-size:10px;opacity:.75}.vote-down::before{content:'▼';font-size:10px;opacity:.75}.reread-btn.is-hidden,.loading-status{display:none !important}button[aria-disabled=true]{opacity:.5;cursor:default}button[aria-pressed=true]{color:var(--fp-primary);border-color:var(--fp-primary);background:var(--fp-primary-soft,rgba(105,170,105,.12))}p{margin:4px 0;font-size:12px}[role=alert]{color:#c34a36}small{color:var(--fp-muted)}</style>
