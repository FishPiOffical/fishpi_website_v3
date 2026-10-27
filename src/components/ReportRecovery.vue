<script setup lang="ts">
import {onBeforeUnmount,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {useAuthStore} from '@/stores/auth'
import {useV3ReportsStore} from '@/stores/v3Reports'
import {fpConfirm} from '@/composables/useDialog'
const auth=useAuthStore(),store=useV3ReportsStore()
let abort:AbortController|null=null
const identity=()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||''])
function cancel(){abort?.abort();abort=null}
async function retry(){if(store.busy||!store.pending)return;cancel();const original=store.pending,reader=identity(),controller=new AbortController();abort=controller;let yes=true;if(store.needsConfirmation)yes=await fpConfirm({title:'再次确认原举报',message:'平台要求再次确认。将以原目标、理由、备注和请求键恢复本次举报，是否继续？',confirmText:'确认原举报',signal:controller.signal});if(yes&&!controller.signal.aborted&&reader===identity()&&store.pending===original)await store.retry(true);if(abort===controller)abort=null}
watch(identity,cancel,{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template><div v-if="auth.accessToken&&(store.pending||store.receipt||store.error)" class="report-recovery">
 <p v-if="store.error" role="alert">{{ store.error }}</p>
 <div v-if="store.pending" role="status"><p>目标 {{ store.pending.input.targetId }} 的举报{{ store.needsConfirmation?'需要再次确认':'结果尚未确认' }}。请保留原操作恢复；刷新或退出会丢失本地恢复信息。</p><button type="button" :disabled="store.busy" @click="retry">{{ store.needsConfirmation?'再次确认原举报':'恢复本次举报' }}</button><button v-if="store.needsConfirmation" type="button" :disabled="store.busy" @click="store.cancelConfirmation">取消待确认举报</button></div>
 <p v-if="store.receipt" role="status">举报提交已确认，编号 {{ store.receipt.id }}。这不代表审核已处理。</p>
 <button v-if="!store.pending&&!store.busy" type="button" @click="store.dismiss">关闭举报提示</button>
</div></template>
<style scoped lang="scss">.report-recovery{box-sizing:border-box;max-width:1100px;width:calc(100% - 24px);margin:8px auto;overflow-wrap:anywhere;font-size:13px}p{margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;margin:3px;padding:5px 8px;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
