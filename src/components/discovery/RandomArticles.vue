<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useDiscoveryExtras } from '@/composables/useDiscoveryExtras'
import { articleTitle } from '@/utils/text'
const props = withDefaults(defineProps<{ size?: number; excludeId?: string }>(), { size: 8, excludeId: '' })
const { value, loading, error, read } = useDiscoveryExtras('random', computed(() => props.size), computed(() => props.excludeId))
const list = computed(() => value.value?.kind === 'random' ? value.value.list : null)
</script>
<template><section class="random-discovery"><header><h2>随机发现</h2><button type="button" :disabled="loading" @click="read()">换一批文章</button></header><p v-if="loading" role="status">正在读取随机发现…</p><div v-else-if="error" role="alert"><p>{{ error }}</p><button type="button" @click="read()">重试随机发现</button></div><template v-else-if="list"><p v-if="!list.length">暂无可见推荐。</p><ul><li v-for="a in list" :key="a.oId"><RouterLink :to="`/article/${a.oId}`">{{ articleTitle(a) }}</RouterLink><RouterLink v-if="a.articleAnonymous !== 1 && a.articleAuthorId && a.articleAuthorName" :to="`/member/${encodeURIComponent(a.articleAuthorName)}`" :data-user-card="a.articleAuthorName">{{ a.articleAuthorName }}</RouterLink><span v-else>匿名用户</span></li></ul></template><p v-else role="status">随机发现尚未读取。</p></section></template>
<style scoped lang="scss">
header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; } h2 { font-size: 16px; margin: 0; color: var(--fp-title); } ul { list-style: none; padding: 0; margin: 12px 0 0; } li { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--fp-border); overflow-wrap: anywhere; } a { color: var(--fp-link); text-decoration: none; } span, p { color: var(--fp-muted); font-size: 13px; } button { padding: 5px 8px; border: 1px solid var(--fp-border); border-radius: 6px; background: var(--fp-card); color: var(--fp-text); cursor: pointer; &:disabled { opacity: .5; } } [role=alert] p { color: #bd503c; }
</style>
