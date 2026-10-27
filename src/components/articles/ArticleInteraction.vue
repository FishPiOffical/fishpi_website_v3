<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { readArticleInteraction, readArticleRewardHtml, type ArticleInteractionKind, type ArticleInteractionState, type VoteChoice, type InteractionResource } from '@/api/v3-article-interactions'
import { fpConfirm } from '@/composables/useDialog'
import { useAuthStore } from '@/stores/auth'
import { useV3ArticleInteractionsStore } from '@/stores/v3ArticleInteractions'
const props = withDefaults(defineProps<{ kind:ArticleInteractionKind; articleId:string; initialPrice?:number; resource?:InteractionResource }>(),{initialPrice:0,resource:'articles'})
const emit = defineEmits<{ contentClick:[event:MouseEvent] }>()
const route = useRoute(), { accessToken, account } = storeToRefs(useAuthStore()), operations = useV3ArticleInteractionsStore()
const mounted=ref(false), state=ref<ArticleInteractionState|null>(null), loading=ref(false), confirming=ref(false), error=ref(''), html=ref('')
const loggedIn=computed(()=>mounted.value && !!accessToken.value && !!account.value)
const pending=computed(()=>operations.commands[(props.resource === 'comments' ? 'comments:' : '')+props.kind+':'+props.articleId])
const vote=computed(()=>state.value?.kind === 'vote' ? state.value : null)
const thanks=computed(()=>state.value?.kind === 'thanks' ? state.value : null)
const acceptance=computed(()=>state.value?.kind === 'accept' ? state.value : null)
const reward=computed(()=>state.value?.kind === 'reward' ? state.value : null)
const price=computed(()=>reward.value?.rewardPoint ?? props.initialPrice)
const busy=computed(()=>loading.value || confirming.value || !!pending.value?.busy)
const label=computed(()=>props.kind === 'vote' ? '投票' : props.kind === 'thanks' ? '感谢' : props.kind === 'accept' ? '采纳' : '打赏')
let sequence=0,boundary=''
let confirmation:AbortController|null=null
function identity(){ return `${getAuthContextVersion()}:${!!accessToken.value}:${account.value?.oId || ''}:${props.resource}:${props.kind}:${props.articleId}` }
function clear(keepState=false){ confirmation?.abort(); confirmation=null; sequence++; if(!keepState)state.value=null; html.value=''; error.value=''; loading.value=false; confirming.value=false }
async function load(afterWrite=false){
  if (!loggedIn.value || loading.value || props.kind === 'reward' && props.initialPrice < 1) return
  const current=++sequence,reader=identity(),kind=props.kind,id=props.articleId
  const valid=()=>mounted.value && loggedIn.value && current === sequence && reader === identity()
  loading.value=true; error.value=''; if(!afterWrite)state.value=null; html.value=''
  try {
    const result=await readArticleInteraction(kind,id,props.resource)
    if (!valid()) return
    const content=result.kind === 'reward' && result.rewarded ? await readArticleRewardHtml(id) : ''
    if (valid()) { state.value=result; html.value=content }
  } catch(reason){ if(valid()) { state.value=null; html.value=''; error.value=(afterWrite?'操作已确认，读取当前状态失败：':'')+(reason instanceof Error ? reason.message : '互动读取失败') } }
  finally { if(valid()) loading.value=false }
}
async function submit(choice:VoteChoice=null,recover=false){
  if (!loggedIn.value || busy.value || pending.value && !recover || !state.value && !pending.value) return
  const reader=identity(),id=props.articleId,kind=props.kind,current=state.value,recovery=pending.value
  const valid=()=>mounted.value && loggedIn.value && reader === identity()
  error.value=''
  try {
    if (!recovery && kind !== 'vote') {
      if (current?.kind === 'thanks' && (current.thanked || current.canThank === false) || current?.kind === 'accept' && (current.accepted || !current.canAccept) || current?.kind === 'reward' && (current.rewarded || current.rewardPoint < 1)) return
      const cost=current?.kind === 'thanks' ? current.thankPoint : current?.kind === 'reward' ? current.rewardPoint : current?.kind === 'accept' ? current.offerPoint : null
      if (cost === null) return
      confirming.value=true
      const controller=new AbortController(); confirmation=controller
      const confirmed=await fpConfirm({signal:controller.signal,title:`${label.value}确认`,message:`当前${label.value}费用为 ${cost} 积分，实际按提交时平台规则结算。是否继续？`,confirmText:`确认${label.value}`})
      if(confirmation === controller) confirmation=null
      if (!valid() || !confirmed || state.value !== current) return
    }
    if (valid()) await operations.set(kind,id,recovery ? recovery.choice : choice,props.resource)
  } catch(reason){ if(valid()) error.value=reason instanceof Error ? reason.message : '互动失败' }
  finally { if(valid()) confirming.value=false }
}
watch([accessToken,()=>account.value?.oId,()=>props.kind,()=>props.articleId,()=>props.resource],()=>{ const next=identity(); if(next === boundary)return; boundary=next; clear(); void load() },{flush:'sync'})
watch(()=>operations.lastChange,change=>{if(change.resource === props.resource && change.kind === props.kind && (change.targetId === props.articleId || change.kind === 'accept' && change.resource === 'comments')){clear(true);void load(true)}},{flush:'sync'})
onMounted(()=>{mounted.value=true;boundary=identity();void load()})
onBeforeUnmount(()=>{mounted.value=false;clear()})
</script>
<template>
  <section v-if="kind === 'reward' ? initialPrice > 0 : loggedIn" class="article-interaction" :class="{ 'reward-panel': kind === 'reward' }" :aria-label="`${resource === 'comments' ? '评论' : '文章'}${label}`">
    <template v-if="kind === 'reward'"><h3>🎁 打赏区</h3><p>当前 {{ price }} 积分，正文以当前阅读权限为准。</p></template>
    <template v-if="loggedIn">
      <p v-if="loading" role="status">正在读取{{ label }}状态…</p>
      <template v-if="pending">
        <button type="button" :disabled="busy" @click="submit(null,true)">{{ pending.busy ? '正在提交…' : `重试本次${label}` }}</button>
        <p v-if="!pending.busy">上次操作结果待确认，请恢复同一次操作；刷新页面或退出会清除本地恢复信息。</p>
      </template>
      <template v-if="state">
        <template v-if="vote">
          <button type="button" :aria-disabled="busy || !!pending" :aria-busy="busy" :aria-pressed="vote.vote === 'up'" @click="submit(vote.vote === 'up' ? null : 'up')">{{ vote.vote === 'up' ? '取消赞同' : '赞同' }} · {{ vote.upCount }}</button>
          <button type="button" :aria-disabled="busy || !!pending" :aria-busy="busy" :aria-pressed="vote.vote === 'down'" @click="submit(vote.vote === 'down' ? null : 'down')">{{ vote.vote === 'down' ? '取消反对' : '反对' }} · {{ vote.downCount }}</button>
        </template>
        <button v-else-if="thanks" type="button" :aria-disabled="busy || !!pending || thanks.thanked || thanks.canThank === false" :aria-busy="busy" @click="submit()">{{ thanks.thanked ? '已感谢' : `感谢（${thanks.thankPoint}积分）` }} · {{ thanks.thankCount }}</button>
        <template v-else-if="acceptance">
          <p v-if="acceptance.accepted">已采纳</p>
          <button v-else-if="acceptance.canAccept" type="button" :aria-disabled="busy || !!pending" :aria-busy="busy" @click="submit()">采纳（{{ acceptance.offerPoint }}积分）</button>
        </template>
        <template v-else-if="reward">
          <p v-if="reward.rewarded">已解锁打赏区</p>
          <button v-else type="button" :aria-disabled="busy || !!pending || price < 1" :aria-busy="busy" @click="submit()">{{ price > 0 ? `打赏 ${price} 积分` : '当前未启用打赏' }}</button>
        </template>
      </template>
      <button v-else-if="!loading && !pending" type="button" :disabled="busy" @click="load()">重读{{ label }}状态</button>
      <template v-if="reward?.rewarded && !loading && !error"><div v-if="html" class="reward-content" v-html="html" @click="emit('contentClick',$event)" /><p v-else>打赏区暂无内容</p></template>
      <p v-if="error || pending?.error" role="alert">{{ error || pending?.error }}</p>
      <p v-if="kind !== 'vote' && operations.balanceError" role="status">{{ operations.balanceError }}</p>
    </template>
    <RouterLink v-else :to="{path:'/login',query:{redirect:route.fullPath}}">登录后打赏</RouterLink>
  </section>
</template>
<style scoped lang="scss">
.article-interaction { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; max-width: 100%; overflow-wrap: anywhere;
  p { margin: 4px 0; } button { border: 1px solid var(--fp-border); border-radius: 6px; padding: 7px 12px; color: var(--fp-text); background: var(--fp-card); cursor: pointer; }
  button:disabled, button[aria-disabled='true'] { opacity: .5; cursor: default; } button[aria-pressed='true'] { color: var(--fp-link); border-color: var(--fp-primary); } [role='alert'] { color: #c34a36; }
}
.reward-panel { display: block; border-top: 1px solid var(--fp-border); padding: 16px 0; margin: 12px 0; h3 { margin: 0 0 8px; } }
.reward-content { min-width: 0; :deep(img), :deep(video) { max-width: 100%; height: auto; } :deep(pre) { overflow-x: auto; } }
</style>
