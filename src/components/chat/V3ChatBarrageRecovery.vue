<script setup lang="ts">
import {onBeforeUnmount,watch} from 'vue'
import {useV3ChatBarrageStore} from '@/stores/v3ChatBarrage'
import {useAuthStore} from '@/stores/auth'
import {getAuthContextVersion} from '@/api/http'
import {fpConfirm} from '@/composables/useDialog'
const store=useV3ChatBarrageStore(),auth=useAuthStore()
let abort:AbortController|null=null
const identity=()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||''])
function cancel(){abort?.abort();abort=null}
async function retry(){if(store.busy||!store.pending)return;cancel();const command=store.pending,reader=identity(),controller=new AbortController();abort=controller;let yes=true;if(store.needsConfirmation)yes=await fpConfirm({title:'再次确认原弹幕',message:'平台要求再次确认原弹幕。将按原正文、颜色及原请求键恢复本次弹幕操作，是否继续？',confirmText:'确认原弹幕',signal:controller.signal});if(yes&&!controller.signal.aborted&&reader===identity()&&store.pending===command)await store.retry(true);if(abort===controller)abort=null}
watch(identity,cancel,{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template><div class="barrage-recovery"><p v-if="store.error" role="alert">{{ store.error }}</p><div v-if="store.pending" role="status"><p>{{ store.needsConfirmation?'平台要求再次确认原弹幕。':'本次弹幕发送结果尚未确认，请保留原操作恢复。' }}</p><button type="button" :disabled="store.busy" @click="retry">{{ store.needsConfirmation?'再次确认原弹幕':'恢复本次弹幕发送' }}</button><button v-if="store.needsConfirmation" type="button" :disabled="store.busy" @click="store.cancelConfirmation">取消待确认弹幕</button><p>整页刷新或退出会清除本地恢复信息，请先恢复原操作并核对回执。</p></div><p v-if="store.receipt" role="status">本次弹幕发送已确认，花费 {{ store.receipt.cost }} {{ store.receipt.unit }}。弹幕即时播放，不保证送达；恢复回执不会补播。</p></div></template>
<style scoped lang="scss">.barrage-recovery{overflow-wrap:anywhere}p{font-size:13px;margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;padding:5px 8px;margin:3px;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
