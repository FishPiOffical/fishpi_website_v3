<script setup lang="ts">
import { useV3ChatAppearanceStore } from '@/stores/v3ChatAppearance'
const appearance=useV3ChatAppearanceStore()
</script>
<template><div v-if="appearance.pending && !appearance.busy" class="appearance-recovery" role="status"><span>聊天外观保存结果尚未确认。</span><button type="button" @click="appearance.retry">恢复原保存操作</button></div></template>
<style scoped>.appearance-recovery{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px 14px;background:var(--fp-card);border:1px solid var(--fp-border);font-size:12px}button{padding:4px 8px;background:var(--fp-hover);color:var(--fp-text);border:1px solid var(--fp-border);border-radius:5px;cursor:pointer}</style>
