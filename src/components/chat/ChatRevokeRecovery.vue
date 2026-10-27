<script setup lang="ts">
import {useV3ChatRevokeStore} from '@/stores/v3ChatRevoke'
const revoke=useV3ChatRevokeStore()
</script>
<template><div class="revoke-state"><p v-if="revoke.error" role="alert">{{ revoke.error }}</p><div v-if="revoke.pending" role="status"><p>消息 {{ revoke.pending.id }} 的撤回结果尚未确认。</p><button type="button" :disabled="revoke.busy" @click="revoke.retry">恢复本次聊天室撤回</button><p>将使用原消息ID和请求键确认。整页刷新或退出会清除本地恢复信息，请先核对原操作。</p></div><p v-if="revoke.receipt" role="status">消息 {{ revoke.receipt.id }} 已撤回，本次消耗 {{ revoke.receipt.cost }} 积分。</p></div></template>
<style scoped lang="scss">.revoke-state{overflow-wrap:anywhere}p{margin:6px 0;font-size:13px}[role=alert]{color:#bd503c}button{font:inherit;border:1px solid var(--fp-border);border-radius:6px;padding:5px 8px;background:var(--fp-card);color:var(--fp-text)}</style>
