<script setup lang="ts">
defineProps<{ label: string; loading: boolean; error: string; ready: boolean; empty: boolean; emptyText: string }>()
defineEmits<{ retry: [] }>()
</script>
<template><div class="home-read-status" :class="{ 'is-ready': ready && !empty && !loading && !error }"><p v-if="loading" role="status">正在读取{{ label }}…</p><div v-else-if="error" role="alert"><p>{{ error }}</p><button type="button" @click="$emit('retry')">重试{{ label }}</button></div><template v-else-if="ready"><p v-if="empty">{{ emptyText }}</p><button type="button" @click="$emit('retry')">刷新{{ label }}</button></template><p v-else role="status">{{ label }}尚未读取。</p></div></template>
<style scoped lang="scss">
.home-read-status { margin: 6px 4px; font-size: 12px; color: var(--fp-muted); &.is-ready { display: none; } p { margin: 4px 0; overflow-wrap: anywhere; } [role=alert] p { color: #bd503c; } button { padding: 2px 8px; border: 1px solid var(--fp-border); border-radius: 4px; background: var(--fp-hover); color: var(--fp-text); cursor: pointer; } }
</style>
