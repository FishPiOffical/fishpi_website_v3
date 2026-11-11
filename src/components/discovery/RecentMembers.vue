<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useDiscoveryExtras } from '@/composables/useDiscoveryExtras'
import { consumeRecentMembersExpiry, consumeRecentMembersPayload } from '@/seo/payload'
import { DEFAULT_AVATAR, avatarUrl, avatarThumbnail } from '@/utils/avatar'
const { value, loading, error, read } = useDiscoveryExtras('recent', undefined, undefined, consumeRecentMembersPayload(), consumeRecentMembersExpiry())
const list = computed(() => value.value?.kind === 'recent' ? value.value.list : null)
function fallback(event: Event) { const image = event.target as HTMLImageElement; if (image.getAttribute('src') !== DEFAULT_AVATAR) image.src = DEFAULT_AVATAR }
</script>
<template><section class="recent-members"><header><h2>最近注册</h2><button type="button" class="refresh-btn" :disabled="loading" @click="read()">刷新最近注册</button></header><p v-if="loading" role="status">正在读取最近注册…</p><div v-else-if="error" role="alert"><p>{{ error }}</p><button type="button" @click="read()">重试最近注册</button></div><template v-if="list"><p v-if="!list.length">暂无最近注册用户。</p><ul><li v-for="u in list" :key="u.id || u.userName"><RouterLink :to="`/member/${encodeURIComponent(u.userName)}`" :data-user-card="u.userName" :title="u.userNickname || u.userName"><img :src="avatarThumbnail(avatarUrl(u), 36)" :data-user-card="u.userName" alt="" loading="lazy" @error="fallback" /><span>{{ u.userNickname || u.userName }}</span></RouterLink></li></ul></template><p v-else-if="!loading && !error" role="status">最近注册尚未读取。</p></section></template>
<style scoped lang="scss">
.recent-members { min-width: 0; margin-top: 10px; } header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid var(--fp-border); padding: 2px 4px 6px; margin-bottom: 8px; } h2 { margin: 0; font-size: 14px; font-weight: 600; color: var(--fp-title); } button { padding: 3px 8px; font-size: 12px; border: 1px solid var(--fp-border); background: var(--fp-card); color: var(--fp-text); border-radius: 5px; cursor: pointer; &:disabled { opacity: .5; } &.refresh-btn { display: none; } } p { margin: 4px 4px; color: var(--fp-muted); font-size: 12px; } [role=alert] p { color: #bd503c; } ul { list-style: none; margin: 0; padding: 2px 4px 4px; display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 5px; } li { min-width: 0; } a { display: block; line-height: 0; text-decoration: none; color: var(--fp-link); transition: transform 0.15s ease; &:hover { transform: scale(1.1); } } img { display: block; width: 100%; aspect-ratio: 1; height: auto; border-radius: var(--fp-avatar-radius); object-fit: cover; background-color: var(--fp-border); border: 1px solid var(--fp-border); } span { display: none; }
</style>
