<script setup lang="ts">
import {onBeforeUnmount,watch} from 'vue'
import {useV3ChatTopicStore} from '@/stores/v3ChatTopic'
import {useV3ChatTimelineStore} from '@/stores/v3ChatTimeline'
import {useAuthStore} from '@/stores/auth'
import {getAuthContextVersion} from '@/api/http'
import {fpConfirm} from '@/composables/useDialog'
const store=useV3ChatTopicStore(),timeline=useV3ChatTimelineStore(),auth=useAuthStore()
let abort:AbortController|null=null
const identity=()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||''])
function cancel(){abort?.abort();abort=null}
async function retry(){if(store.busy||!store.pending)return;cancel();const command=store.pending,reader=identity(),controller=new AbortController();abort=controller;let yes=true;if(store.needsConfirmation)yes=await fpConfirm({title:'再次确认原话题',message:'平台要求再次确认原话题。将按原文本及原请求键恢复本次16积分操作，是否继续？',confirmText:'确认原话题',signal:controller.signal});if(yes&&!controller.signal.aborted&&reader===identity()&&store.pending===command)await store.retry(true);if(abort===controller)abort=null}
watch(identity,cancel,{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template><div class="topic-recovery"><p v-if="store.error" role="alert">{{ store.error }}</p><div v-if="store.pending" role="status"><p>{{ store.needsConfirmation?'平台要求再次确认原话题。':'本次话题修改结果尚未确认，请保留原操作恢复。' }}</p><button type="button" :disabled="store.busy" @click="retry">{{ store.needsConfirmation?'再次确认原话题':'恢复本次话题修改' }}</button><button v-if="store.needsConfirmation" type="button" :disabled="store.busy" @click="store.cancelConfirmation">取消待确认话题</button><p>整页刷新或退出会清除本地恢复信息，请先核对当前话题和原操作。</p></div><p v-if="store.receipt" role="status">本次话题修改已确认，消耗 {{ store.receipt.cost }} 积分。当前话题以重新读取为准。</p><p v-if="store.receipt&&timeline.topicError" role="alert">{{ timeline.topicError }} <button type="button" @click="timeline.readTopic">重读当前话题</button></p></div></template>
<style scoped lang="scss">.topic-recovery{overflow-wrap:anywhere}p{font-size:13px;margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;padding:5px 8px;margin:3px;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
