<script setup lang="ts">
import {computed,onBeforeUnmount,watch} from 'vue'
import {storeToRefs} from 'pinia'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatRevokeStore} from '@/stores/v3ChatRevoke'
import {getAuthContextVersion} from '@/api/http'
import {fpConfirm} from '@/composables/useDialog'
const props=defineProps<{id:string;authorId?:string;redPacket?:boolean}>(),store=useV3ChatRevokeStore(),{accessToken,account}=storeToRefs(useAuthStore())
let abort:AbortController|null=null
// 管理撤回只信任服务端能力，不能根据昵称、角色展示名或 isAdmin 猜测授权。
const canRevokeOthers=computed(()=>account.value?.capabilities?.chatRevokeOthers===true)
const canRevoke=computed(()=>!!accessToken.value&&!!account.value?.oId&&!!props.authorId&&!props.redPacket&&(props.authorId===account.value.oId||canRevokeOthers.value))
const identity=()=>JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||'',props.id,props.authorId||'',!!props.redPacket,canRevokeOthers.value])
function cancel(){abort?.abort();abort=null}
async function request(){if(store.busy||store.pending||!canRevoke.value)return;cancel();const controller=new AbortController();abort=controller;const reader=identity(),id=props.id
 const yes=await fpConfirm({title:canRevokeOthers.value?'管理撤回聊天室消息':'撤回本条聊天室消息',message:canRevokeOthers.value?'将按当前管理权限撤回这条消息。撤回后无法恢复正文，是否继续？':'普通用户当天费用依次为0、32、64……积分，实际费用由服务端结算。撤回后无法恢复正文，是否继续？',confirmText:'确认撤回',tone:'danger',signal:controller.signal})
 if(yes&&!controller.signal.aborted&&reader===identity()&&canRevoke.value)await store.revoke(id);if(abort===controller)abort=null}
watch(identity,cancel,{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template><button v-if="canRevoke" type="button" title="撤回发言" :disabled="store.busy||!!store.pending" @click="request">撤回</button></template>
