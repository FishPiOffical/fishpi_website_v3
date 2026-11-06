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
.breezemoon-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

li {
  padding: 14px 16px;
  background: var(--fp-surface-subtle);
  border: 1px solid var(--fp-divider);
  border-radius: 10px;
  min-width: 0;
  transition: border-color 0.16s ease, background-color 0.16s ease;

  &:hover {
    border-color: var(--fp-border);
  }
}

header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

header a {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--fp-title);
  font-weight: 600;
  min-width: 0;
  overflow-wrap: anywhere;
  text-decoration: none;

  &:hover {
    color: var(--fp-accent);
  }
}

img {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  object-fit: cover;
  border: 1px solid var(--fp-divider);
  flex-shrink: 0;
}

time {
  color: var(--fp-muted);
  font-size: 12px;
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.moon-body {
  margin-top: 8px;
  padding-left: 44px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--fp-text);
  overflow-wrap: anywhere;
  overflow: auto;

  :deep(p) {
    margin: 0 0 4px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
  }

  :deep(pre) {
    overflow: auto;
  }
}

.compact {
  font-size: 12px;
  gap: 2px;

  li {
    padding: 6px 4px;
    background: transparent;
    border: 0;
    border-top: 1px solid var(--fp-divider);
    border-radius: 0;

    &:first-child {
      border-top: 0;
    }
  }

  header {
    gap: 6px;
  }

  header a {
    gap: 6px;
  }

  img {
    width: 20px;
    height: 20px;
    border-radius: 4px;
  }

  time {
    font-size: 11px;
  }

  .moon-body {
    margin-top: 4px;
    padding-left: 0;
    font-size: 12.5px;
    line-height: 1.45;
    color: var(--fp-text);
  }
}
</style>
