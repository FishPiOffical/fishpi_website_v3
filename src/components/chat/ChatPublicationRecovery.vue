<script setup lang="ts">
import {onBeforeUnmount,watch} from 'vue'
import {storeToRefs} from 'pinia'
import {useAuthStore} from '@/stores/auth'
import {getAuthContextVersion} from '@/api/http'
import {useV3ChatPublicationStore} from '@/stores/v3ChatPublication'
import {fpConfirm} from '@/composables/useDialog'
const emit=defineEmits<{confirmed:[content:string]}>(),publication=useV3ChatPublicationStore(),{accessToken,account}=storeToRefs(useAuthStore())
const identity=()=>JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||''])
let abort:AbortController|null=null,disposed=false
function cancel(){abort?.abort();abort=null}
async function retry(){if(!accessToken.value||!account.value?.oId||publication.busy)return;const reader=identity(),command=publication.pending;if(!command)return;cancel();const controller=new AbortController();abort=controller;try{let confirmed=false;if(publication.needsConfirmation){confirmed=await fpConfirm({signal:controller.signal,title:'再次确认发送原消息',message:'平台要求再次确认本条内容。将使用原请求键和原正文发送，是否继续？',confirmText:'确认发送'});if(!confirmed)return}if(disposed||controller.signal.aborted||reader!==identity()||publication.pending!==command)return;if(await publication.retry(confirmed)){if(!disposed&&reader===identity())emit('confirmed',command.content)}}finally{if(abort===controller)abort=null}}
watch(identity,cancel,{flush:'sync'});onBeforeUnmount(()=>{disposed=true;cancel()})
</script>
<template><div v-if="accessToken&&account?.oId" class="publication-state">
 <p v-if="publication.error" role="alert">{{ publication.error }}</p>
 <div v-if="publication.pending" role="status"><p>{{ publication.needsConfirmation?'平台要求再次确认本条内容。':'本次发送结果未确认，请恢复原操作，避免重复发信。' }}</p><button type="button" :disabled="publication.busy" @click="retry">{{ publication.needsConfirmation?'再次确认原消息':'恢复本次聊天室发送' }}</button><button v-if="publication.needsConfirmation" type="button" :disabled="publication.busy" @click="publication.cancelRequestedConfirmation">取消本次待确认发送</button><p>整页刷新或退出会清除本地恢复信息，请先核对原操作。</p></div>
 <p v-if="publication.receipt" role="status">消息 {{ publication.receipt.id }} 的发送已确认。当前正文以重新读取为准。</p>
 <p v-if="publication.reading" role="status">正在读取当前消息…</p><p v-if="publication.readError" role="alert">{{ publication.readError }} <button type="button" :disabled="publication.reading" @click="publication.readCurrent">重读已发送消息</button></p>
</div></template>
<style scoped lang="scss">.publication-state{overflow-wrap:anywhere}p{font-size:13px;margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;border:1px solid var(--fp-border);border-radius:6px;padding:5px 8px;margin:3px;background:var(--fp-card);color:var(--fp-text)}</style>
