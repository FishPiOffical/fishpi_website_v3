<script setup lang="ts">
import {onBeforeUnmount,watch} from 'vue'
import {storeToRefs} from 'pinia'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatRevokeStore} from '@/stores/v3ChatRevoke'
import {getAuthContextVersion} from '@/api/http'
import {fpConfirm} from '@/composables/useDialog'
const props=defineProps<{id:string;authorId?:string;redPacket?:boolean}>(),store=useV3ChatRevokeStore(),{accessToken,account}=storeToRefs(useAuthStore())
let abort:AbortController|null=null
const identity=()=>JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||'',props.id,props.authorId||''])
function cancel(){abort?.abort();abort=null}
async function request(){if(store.busy||store.pending||!accessToken.value||!account.value?.oId||props.authorId!==account.value.oId||props.redPacket)return;cancel();const controller=new AbortController();abort=controller;const reader=identity(),id=props.id
 const yes=await fpConfirm({title:'撤回本条聊天室消息',message:'普通用户当天费用依次为0、32、64……积分，实际费用由服务端结算。撤回后无法恢复正文，是否继续？',confirmText:'确认撤回',tone:'danger',signal:controller.signal})
 if(yes&&!controller.signal.aborted&&reader===identity())await store.revoke(id);if(abort===controller)abort=null}
watch(identity,cancel,{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template><button v-if="accessToken&&account?.oId&&authorId===account.oId&&!redPacket" type="button" title="撤回发言" :disabled="store.busy||!!store.pending" @click="request">撤回</button></template>
