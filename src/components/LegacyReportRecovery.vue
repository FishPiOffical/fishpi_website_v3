<script setup lang="ts">
import {useLegacyReportsStore} from '@/stores/legacyReports'
const store=useLegacyReportsStore()
</script>
<template><div v-if="store.pending||store.confirmed||store.error" class="report-state"><p v-if="store.error" role="alert">{{ store.error }}</p><div v-if="store.pending" role="status"><p>目标 {{ store.pending.input.targetId }} 的举报结果未确认。旧接口没有编号查询和幂等恢复，请先核对，不要重复提交。</p><button type="button" :disabled="store.busy" @click="store.release">我已核对，解除锁定</button></div><p v-if="store.confirmed" role="status">举报提交已确认，这不代表审核已处理。旧接口未提供举报编号。</p><button v-if="!store.pending&&!store.busy" type="button" @click="store.dismiss">关闭举报提示</button></div></template>
<style scoped lang="scss">.report-state{box-sizing:border-box;max-width:1100px;width:calc(100% - 24px);margin:8px auto;overflow-wrap:anywhere;font-size:13px}p{margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;border:1px solid var(--fp-border);border-radius:5px;padding:5px 8px;background:var(--fp-card);color:var(--fp-text)}</style>
