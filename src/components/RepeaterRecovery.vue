<script setup lang="ts">
import {onBeforeUnmount,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {useAuthStore} from '@/stores/auth'
import {useV3RepeaterStore} from '@/stores/v3Repeater'
import {fpConfirm} from '@/composables/useDialog'
const auth=useAuthStore(),store=useV3RepeaterStore()
let abort:AbortController|null=null
const identity=()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||''])
function cancel(){abort?.abort();abort=null}
async function retry(){if(store.busy||!store.pending)return;cancel();const original=store.pending,reader=identity(),controller=new AbortController();abort=controller;let yes=true;if(store.needsConfirmation)yes=await fpConfirm({title:'再次确认原复读机操作',message:'平台要求再次确认。将以原投稿正文或点赞状态及请求键恢复本次复读机操作，是否继续？',confirmText:'确认原复读机操作',signal:controller.signal});if(yes&&!controller.signal.aborted&&reader===identity()&&store.pending===original)await store.retry(true);if(abort===controller)abort=null}
watch(identity,cancel,{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template><div v-if="auth.accessToken&&!store.busy&&(store.pending||store.error)" class="repeater-recovery"><p v-if="store.error" role="alert">{{ store.error }}</p><div v-if="store.pending" role="status"><p class="fp-retry-copy">{{ store.pending.kind==='publish'?'复读投稿':'点赞' }}结果尚未确认，原操作可恢复；刷新或退出会丢失本地恢复信息。</p><button class="fp-retry-icon" type="button" :disabled="store.busy" @click="retry" :title="store.needsConfirmation?'再次确认原复读机操作':'恢复本次复读机操作'">{{ store.needsConfirmation?'再次确认原复读机操作':'恢复本次复读机操作' }}</button><button v-if="store.needsConfirmation" type="button" :disabled="store.busy" @click="store.cancelConfirmation">取消待确认操作</button></div><button v-if="!store.pending&&!store.busy" type="button" @click="store.dismiss">关闭复读机提示</button></div></template>
<style scoped lang="scss">.repeater-recovery{box-sizing:border-box;max-width:1100px;width:calc(100% - 24px);margin:8px auto;overflow-wrap:anywhere;font-size:13px}p{margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;margin:3px;padding:5px 8px;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
