<script setup lang="ts">
import {useV3ChatRevokeStore} from '@/stores/v3ChatRevoke'
const revoke=useV3ChatRevokeStore()
</script>
<template><div v-if="!revoke.busy&&(revoke.error||revoke.pending)" class="revoke-state"><p v-if="revoke.error" role="alert">{{ revoke.error }}</p><div v-if="revoke.pending" role="status"><p>暂未确认消息是否撤回，请重试。</p><button type="button" :disabled="revoke.busy" @click="revoke.retry">恢复本次聊天室撤回</button><p>将使用原消息ID和请求键确认。整页刷新或退出会清除本地恢复信息，请先核对原操作。</p></div></div></template>
<style scoped lang="scss">.revoke-state{overflow-wrap:anywhere}p{margin:6px 0;font-size:13px}[role=alert]{color:#bd503c}button{font:inherit;border:1px solid var(--fp-border);border-radius:6px;padding:5px 8px;background:var(--fp-card);color:var(--fp-text)}</style>
