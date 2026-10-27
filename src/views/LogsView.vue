<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDiscoveryExtras } from '@/composables/useDiscoveryExtras'
import { usePageSeo } from '@/composables/usePageSeo'
const auth = useAuthStore(), { value, p, loading, error, read } = useDiscoveryExtras('logs')
const records = computed(() => value.value?.kind === 'logs' ? value.value : null)
usePageSeo(() => ({ title: '公开日志', path: '/logs', robots: 'noindex' }))
</script>
<template><section class="public-logs"><h1>公开日志</h1><p>展示公开操作的记录时间与类别。</p><p v-if="!auth.isLoggedIn"><RouterLink :to="{ path: '/login', query: { redirect: '/logs' } }">登录后查看</RouterLink></p><template v-else><button type="button" :disabled="loading" @click="read()">刷新公开日志</button><p v-if="loading" role="status">正在读取公开日志…</p><div v-else-if="error" role="alert"><p>{{ error }}</p><button type="button" @click="read()">重试公开日志</button><button v-if="p > 1" type="button" @click="read(1)">返回日志首页</button></div><template v-else-if="records"><p>共 {{ records.total }} 条</p><ol><li v-for="item in records.list" :key="item.id"><b>{{ item.category }}</b><time :datetime="item.time.replace(' ', 'T')">{{ item.time }}</time><small>记录 {{ item.id }}</small></li></ol><p v-if="!records.list.length">本页没有公开日志。</p><nav><button type="button" :disabled="p <= 1" @click="read(p - 1)">上一页日志</button><span>第 {{ p }} 页 / 共 {{ records.pageCount }} 页</span><button type="button" :disabled="p >= records.pageCount" @click="read(p + 1)">下一页日志</button><button v-if="p > records.pageCount" type="button" @click="read(1)">返回日志首页</button></nav></template><p v-else role="status">公开日志尚未读取。</p></template></section></template>
<style scoped lang="scss">
.public-logs { padding: 20px; background: var(--fp-card); border: 1px solid var(--fp-border); border-radius: 10px; color: var(--fp-text); } h1 { font-size: 23px; } p, time, small { color: var(--fp-muted); } ol { list-style: none; padding: 0; } li { display: flex; flex-wrap: wrap; gap: 12px; align-items: baseline; padding: 14px 0; border-bottom: 1px solid var(--fp-border); overflow-wrap: anywhere; } nav { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; } button { padding: 7px 10px; border: 1px solid var(--fp-border); border-radius: 6px; background: var(--fp-card); color: var(--fp-text); margin: 4px; cursor: pointer; &:disabled { opacity: .5; } } [role=alert] p { color: #bd503c; } a { color: var(--fp-link); } @media(max-width:600px) { .public-logs { padding: 14px; } li { flex-direction: column; gap: 6px; } }
</style>
