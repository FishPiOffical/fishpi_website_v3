<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { FollowingMoon } from '@/api/v3-following-feed'
import VipNickname from '@/components/user/VipNickname.vue'
import { avatarUrl, DEFAULT_AVATAR } from '@/utils/avatar'
defineProps<{items:FollowingMoon[];compact?:boolean}>()
function fallback(event:Event){const image=event.target as HTMLImageElement;if(image.getAttribute('src')!==DEFAULT_AVATAR)image.src=DEFAULT_AVATAR}
function date(value:number){return new Date(value).toISOString().replace('T',' ').replace('.000Z',' UTC')}
</script>
<template>
  <ul class="breezemoon-list" :class="{compact}"><li v-for="item in items" :key="item.id">
    <header><RouterLink :to="`/member/${encodeURIComponent(item.author.userName)}`" :data-user-card="item.author.userName"><img :src="avatarUrl(item.author)" :data-user-card="item.author.userName" alt="" loading="lazy" @error="fallback" /><VipNickname :user-id="item.author.id" :user-name="item.author.userName" :text="item.author.userNickname||item.author.userName" /></RouterLink><time :datetime="new Date(item.createdAt).toISOString()">{{ date(item.createdAt) }}</time><slot name="actions" :item="item" /></header>
    <div class="moon-body" v-html="item.contentHtml" />
  </li></ul>
</template>
<style scoped lang="scss">
.compact { font-size: 12px; } .compact li { padding: 10px 0; } .breezemoon-list { list-style: none; margin: 0; padding: 0; } li { padding: 18px; border-top: 1px solid var(--fp-border); min-width: 0; } header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; } header a { display: flex; align-items: center; gap: 10px; color: var(--fp-link); min-width: 0; overflow-wrap: anywhere; } img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; } time { color: var(--fp-muted); font-size: 12px; } .moon-body { margin-top: 12px; line-height: 1.7; overflow-wrap: anywhere; overflow: auto; :deep(img) { max-width: 100%; height: auto; } :deep(pre) { overflow: auto; } }
</style>
