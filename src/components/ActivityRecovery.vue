<script setup lang="ts">
import {onBeforeUnmount,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {useAuthStore} from '@/stores/auth'
import {useV3ActivityStore} from '@/stores/v3Activity'
import {fpConfirm} from '@/composables/useDialog'
const auth=useAuthStore(),store=useV3ActivityStore()
let abort:AbortController|null=null
const identity=()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||''])
function cancel(){abort?.abort();abort=null}
async function retry(){if(store.busy||!store.pending)return;cancel();const original=store.pending,reader=identity(),controller=new AbortController();abort=controller;let yes=true;if(store.needsConfirmation)yes=await fpConfirm({title:'再次确认原奖励领取',message:'平台要求再次确认。将以原奖励日期及请求键恢复本次领取，是否继续？',confirmText:'确认原奖励领取',signal:controller.signal});if(yes&&!controller.signal.aborted&&reader===identity()&&store.pending===original)await store.retry(true);if(abort===controller)abort=null}
watch(identity,cancel,{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template><div v-if="auth.accessToken&&!store.busy&&(store.pending||store.error)" class="activity-recovery"><p v-if="store.error" role="alert">{{ store.error }}</p><div v-if="store.pending" role="status"><p>暂未确认是否领取成功，请重试本次领取。</p><button type="button" :disabled="store.busy" @click="retry">{{ store.needsConfirmation?'再次确认原奖励领取':'恢复本次奖励领取' }}</button><button v-if="store.needsConfirmation" type="button" :disabled="store.busy" @click="store.cancelConfirmation">取消待确认操作</button></div><button v-if="!store.pending&&!store.busy" type="button" @click="store.dismiss">关闭奖励提示</button></div></template>
<style scoped lang="scss">.activity-recovery{box-sizing:border-box;max-width:1100px;width:calc(100% - 24px);margin:8px auto;overflow-wrap:anywhere;font-size:13px}p{margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;margin:3px;padding:5px 8px;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
