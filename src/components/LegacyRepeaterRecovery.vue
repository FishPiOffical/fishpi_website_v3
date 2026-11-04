<script setup lang="ts">
import {useAuthStore} from '@/stores/auth'
import {useLegacyRepeaterStore} from '@/stores/legacyRepeater'
const auth=useAuthStore(),store=useLegacyRepeaterStore()
</script>
<template><div v-if="auth.apiKey&&(store.pending||store.receipt||store.error)" class="repeater-recovery"><p v-if="store.error" role="alert">{{ store.error }}</p><div v-if="store.pending" role="status"><p>{{ store.pending.kind==='publish'?'原复读投稿':'内容 '+store.pending.id+' 的点赞切换' }}结果未确认。旧接口不能幂等恢复，请先读取榜单核对，不要重复提交。</p><button type="button" :disabled="store.busy" @click="store.release">我已核对，解除锁定</button></div><p v-if="store.receipt" role="status">内容 {{ store.receipt.id }} 的操作已确认，正文及点赞状态以重新读取为准。</p><button v-if="!store.pending&&!store.busy" type="button" @click="store.dismiss">关闭复读机提示</button></div></template>
<style scoped lang="scss">.repeater-recovery{box-sizing:border-box;max-width:1100px;width:calc(100% - 24px);margin:8px auto;overflow-wrap:anywhere;font-size:13px}p{margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;margin:3px;padding:5px 8px;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
