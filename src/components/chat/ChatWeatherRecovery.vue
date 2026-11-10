<script setup lang="ts">
import {onBeforeUnmount,watch} from 'vue'
import {storeToRefs} from 'pinia'
import {useAuthStore} from '@/stores/auth'
import {getAuthContextVersion} from '@/api/http'
import {useV3ChatWeatherStore} from '@/stores/v3ChatWeather'
import {fpConfirm} from '@/composables/useDialog'
const publication=useV3ChatWeatherStore(),{accessToken,account}=storeToRefs(useAuthStore())
const identity=()=>JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||''])
let abort:AbortController|null=null,disposed=false
function cancel(){abort?.abort();abort=null}
async function retry(){if(!accessToken.value||!account.value?.oId||publication.busy)return;const reader=identity(),command=publication.pending;if(!command)return;cancel();const controller=new AbortController();abort=controller;try{let confirmed=false;if(publication.needsConfirmation){confirmed=await fpConfirm({signal:controller.signal,title:'再次确认发送原天气卡片',message:'平台要求再次确认本天气卡片。将使用原请求键和原天气字段发送，是否继续？',confirmText:'确认发送'});if(!confirmed)return}if(disposed||controller.signal.aborted||reader!==identity()||publication.pending!==command)return;await publication.retry(confirmed)}finally{if(abort===controller)abort=null}}
watch(identity,cancel,{flush:'sync'});onBeforeUnmount(()=>{disposed=true;cancel()})
</script>
<template><div v-if="!publication.busy&&(accessToken&&account?.oId&&(publication.error||publication.pending||publication.readError))" class="publication-state">
 <p v-if="publication.error" role="alert">{{ publication.error }}</p>
 <div v-if="publication.pending" role="status"><p class="fp-retry-copy">{{ publication.needsConfirmation?'平台要求再次确认本天气卡片。':'本次天气卡片发送结果未确认，请恢复原操作，避免重复发信。' }}</p><button class="fp-retry-icon" type="button" :disabled="publication.busy" @click="retry" :title="publication.needsConfirmation?'再次确认原天气卡片':'恢复本次天气卡片发送'">{{ publication.needsConfirmation?'再次确认原天气卡片':'恢复本次天气卡片发送' }}</button><button v-if="publication.needsConfirmation" type="button" :disabled="publication.busy" @click="publication.cancelRequestedConfirmation">取消本次待确认发送</button><p>整页刷新或退出会清除本地恢复信息，请先核对原操作。</p></div><p v-if="publication.readError" role="alert">{{ publication.readError }} <button class="fp-retry-icon" type="button" :disabled="publication.reading" @click="publication.readCurrent" title="重读已发送消息">重读已发送消息</button></p>
</div></template>
<style scoped lang="scss">.publication-state{overflow-wrap:anywhere}p{font-size:13px;margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;border:1px solid var(--fp-border);border-radius:6px;padding:5px 8px;margin:3px;background:var(--fp-card);color:var(--fp-text)}</style>
