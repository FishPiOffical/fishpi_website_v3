<script setup lang="ts">
import {useLegacyChatActionsStore} from '@/stores/legacyChatActions'
const store=useLegacyChatActionsStore()
</script>
<template><div class="barrage-state"><p v-if="store.error&&store.errorKind==='barrage'" role="alert">{{ store.error }}</p><div v-if="store.pending?.kind==='barrage'" role="status"><p>本次弹幕结果未确认，请核对积分记录。弹幕即时播放，不能从历史记录判断是否发送。</p><p>原正文：{{ store.pending.input.content }}；颜色：{{ store.pending.input.color }}</p><p>旧接口没有幂等恢复，不会自动重发或补播。</p><button type="button" :disabled="store.busy" @click="store.release">我已核对，解除锁定</button></div><p v-if="store.completed?.kind==='barrage'" role="status">本次弹幕发送已确认，实际费用请查看积分记录。弹幕即时播放，不保证送达，不会补播。</p></div></template>
<style scoped lang="scss">.barrage-state{overflow-wrap:anywhere}p{font-size:13px;margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;border:1px solid var(--fp-border);border-radius:5px;padding:5px 8px;background:var(--fp-card);color:var(--fp-text)}</style>
