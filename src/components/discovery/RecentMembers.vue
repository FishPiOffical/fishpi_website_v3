<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useDiscoveryExtras } from '@/composables/useDiscoveryExtras'
import { consumeRecentMembersPayload } from '@/seo/payload'
import { DEFAULT_AVATAR, avatarUrl } from '@/utils/avatar'
const { value, loading, error, read } = useDiscoveryExtras('recent', undefined, undefined, consumeRecentMembersPayload())
const list = computed(() => value.value?.kind === 'recent' ? value.value.list : null)
function fallback(event: Event) { const image = event.target as HTMLImageElement; if (image.getAttribute('src') !== DEFAULT_AVATAR) image.src = DEFAULT_AVATAR }
</script>
<template><section class="recent-members"><header><h2>最近注册</h2><button type="button" :disabled="loading" @click="read()">刷新最近注册</button></header><p v-if="loading" role="status">正在读取最近注册…</p><div v-else-if="error" role="alert"><p>{{ error }}</p><button type="button" @click="read()">重试最近注册</button></div><template v-else-if="list"><p v-if="!list.length">暂无最近注册用户。</p><ul><li v-for="u in list" :key="u.id"><RouterLink :to="`/member/${encodeURIComponent(u.userName)}`" :data-user-card="u.userName"><img :src="avatarUrl(u)" :data-user-card="u.userName" alt="" loading="lazy" @error="fallback" /><span>{{ u.userNickname || u.userName }}</span></RouterLink></li></ul></template><p v-else role="status">最近注册尚未读取。</p></section></template>
<style scoped lang="scss">
.recent-members { min-width: 0; margin-top: 12px; } header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; } h2 { margin: 0; font-size: 16px; color: var(--fp-title); } button { padding: 5px 8px; border: 1px solid var(--fp-border); background: var(--fp-card); color: var(--fp-text); border-radius: 6px; cursor: pointer; &:disabled { opacity: .5; } } p { color: var(--fp-muted); font-size: 13px; } [role=alert] p { color: #bd503c; } ul { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fit,minmax(80px,1fr)); gap: 10px; } li { min-width: 0; } a { display: flex; flex-direction: column; align-items: center; gap: 6px; text-decoration: none; color: var(--fp-link); overflow-wrap: anywhere; } img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; } span { text-align: center; font-size: 12px; }
</style>
