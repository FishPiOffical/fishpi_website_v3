<script setup lang="ts">
import {computed,onMounted,onScopeDispose,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {useAuthStore} from '@/stores/auth'
import {useLegacyCommentVotesStore} from '@/stores/legacyCommentVotes'
import type {LegacyCommentVote} from '@/api/legacy/comment-votes'
import type {LegacyReactionSource} from '@/api/legacy/reactions'
const props=defineProps<{commentId:string;source?:LegacyReactionSource}>(),auth=useAuthStore(),operations=useLegacyCommentVotesStore()
const mounted=ref(false),state=ref<LegacyCommentVote|null>(null),loading=ref(false),error=ref('')
const visible=computed(()=>mounted.value&&!!auth.apiKey&&!!auth.account?.oId),pending=computed(()=>operations.commands[props.commentId])
let sequence=0
const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId,props.commentId,props.source?.articleId,props.source?.paragraphId,props.source?.page,props.source?.sort])
function clear(){sequence++;state.value=null;loading.value=false;error.value=''}
async function load(){if(!visible.value)return;const actor=identity(),run=++sequence,valid=()=>visible.value&&actor===identity()&&run===sequence;state.value=null;loading.value=true;error.value=''
 try{const value=await operations.read(props.commentId,props.source||{});if(valid())state.value=value}catch(e){if(valid())error.value=e instanceof Error?e.message:'评论投票读取失败'}finally{if(valid())loading.value=false}
}
function submit(choice:'up'|'down'){if(!visible.value||loading.value||!state.value||pending.value)return;void operations.set(props.commentId,state.value.vote===choice?null:choice,props.source||{})}
watch(identity,()=>{clear();void load()},{flush:'sync'})
watch(()=>operations.lastChange,value=>{if(value.id===props.commentId){clear();void load()}},{flush:'sync'})
onMounted(()=>{mounted.value=true;void load()});onScopeDispose(()=>{mounted.value=false;clear()})
</script>
<template><span v-if="visible" class="legacy-comment-vote" aria-label="评论投票"><button type="button" class="cmt-vote-btn vote-up" :aria-pressed="state?.vote==='up'" :aria-disabled="loading||!!pending||!state" :aria-busy="loading||pending?.busy" @click="submit('up')">{{ state?.vote==='up'?'取消赞同':'赞同' }}<template v-if="state"> · {{ state.upCount }}</template></button><button type="button" class="cmt-vote-btn vote-down" :aria-pressed="state?.vote==='down'" :aria-disabled="loading||!!pending||!state" :aria-busy="loading||pending?.busy" @click="submit('down')">{{ state?.vote==='down'?'取消反对':'反对' }}<template v-if="state"> · {{ state.downCount }}</template></button><button type="button" class="reread-btn" :class="{'is-hidden':state&&!error&&!pending&&!operations.errors[commentId]}" :aria-disabled="loading||pending?.busy" @click="!loading&&!pending?.busy&&load()">重读评论投票</button><span v-if="error||pending?.error||operations.errors[commentId]" role="alert">{{ error||pending?.error||operations.errors[commentId] }}</span><template v-if="pending&&!pending.busy"><span>切换结果未确认，请先重读核对。其他设备投票可能改变当前结果。</span><button type="button" :disabled="!pending.verified||loading||!state||!!error" @click="operations.release(commentId)">我已核对，解除投票锁定</button></template></span></template>
<style scoped lang="scss">.legacy-comment-vote{display:inline-flex;gap:4px;align-items:center;flex-wrap:wrap;max-width:100%;overflow-wrap:anywhere}button{display:inline-flex;align-items:center;gap:3px;height:24px;border:0;border-radius:999px;padding:0 7px;font-size:12px;background:transparent;color:var(--fp-muted);cursor:pointer;transition:background-color .14s,color .14s}button:hover:not([aria-disabled=true]){background:var(--fp-hover);color:var(--fp-title)}.vote-up::before{content:'▲';font-size:9px;opacity:.75}.vote-down::before{content:'▼';font-size:9px;opacity:.75}.reread-btn.is-hidden{display:none !important}button[aria-disabled=true],button:disabled{opacity:.5;cursor:default}button[aria-pressed=true]{color:var(--fp-primary);background:var(--fp-primary-soft,rgba(105,170,105,.14));font-weight:500}[role=alert]{color:#c34a36;font-size:12px}</style>
