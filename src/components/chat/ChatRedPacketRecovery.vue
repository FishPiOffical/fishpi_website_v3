<script setup lang="ts">
import {onBeforeUnmount,watch} from 'vue'
import {useV3ChatRedPacketsStore} from '@/stores/v3ChatRedPackets'
import {useAuthStore} from '@/stores/auth'
import {getAuthContextVersion} from '@/api/http'
import {fpConfirm} from '@/composables/useDialog'
const props=defineProps<{kind?:'create'|'claim'; packetId?:string}>()
const store=useV3ChatRedPacketsStore(),auth=useAuthStore()
let abort:AbortController|null=null
const identity=()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||''])
function cancel(){abort?.abort();abort=null}
async function retry(){if(store.busy||!store.pending)return;cancel();const command=store.pending,reader=identity(),controller=new AbortController();abort=controller;let yes=true;if(store.needsConfirmation)yes=await fpConfirm({title:'再次确认原红包操作',message:'平台要求再次确认。将恢复原创建或领取操作，保持原红包、金额、出拳和风险确认，不重复结算。是否继续？',confirmText:'确认原操作',signal:controller.signal});if(yes&&!controller.signal.aborted&&reader===identity()&&store.pending===command)await store.retry(true);if(abort===controller)abort=null}
watch(identity,cancel,{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template><div v-if="!store.busy&&(auth.accessToken&&(!props.kind||props.kind===store.lastAttempt?.kind)&&(!props.packetId||props.packetId===store.lastAttempt?.id)&&(store.error||store.pending||store.readError))" class="packet-recovery"><p v-if="store.error" role="alert">{{ store.error }}</p><div v-if="store.pending" role="status"><p>{{ store.pending.kind==='create'?'红包创建':'红包领取' }}结果尚未确认，请恢复原操作。刷新或退出会丢失本地恢复信息。</p><button type="button" :disabled="store.busy" @click="retry">{{ store.needsConfirmation?'再次确认原红包操作':'恢复本次红包操作' }}</button><button v-if="store.needsConfirmation" type="button" :disabled="store.busy" @click="store.cancelConfirmation">取消待确认操作</button></div><p v-if="store.readError" role="alert">{{ store.readError }} <button type="button" :disabled="store.reading" @click="store.readCurrent">重读当前红包消息</button></p><button v-if="!store.pending&&!store.busy&&(store.error||store.readError)" type="button" @click="store.dismiss">关闭提示</button></div></template>
<style scoped lang="scss">.packet-recovery{box-sizing:border-box;max-width:1100px;width:calc(100% - 24px);margin:8px auto;overflow-wrap:anywhere;font-size:13px}p{margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;margin:3px;padding:5px 8px;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
