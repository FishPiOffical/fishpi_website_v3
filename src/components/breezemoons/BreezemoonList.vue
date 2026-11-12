<script setup lang="ts">
import { inject, type Ref } from 'vue'
import { timeISO } from '@/utils/time'

import { formatDateTime } from '@/utils/time'

import { RouterLink } from 'vue-router'
import type { BreezemoonQuoteSource } from '@/utils/breezemoonQuote'
import type { FollowingMoon } from '@/api/v3-following-feed'
import VipNickname from '@/components/user/VipNickname.vue'
import { avatarUrl, DEFAULT_AVATAR, avatarThumbnail } from '@/utils/avatar'
defineProps<{items:FollowingMoon[];compact?:boolean;avatarOnly?:boolean;hideAuthor?:boolean}>()
function fallback(event:Event){const image=event.target as HTMLImageElement;if(image.getAttribute('src')!==DEFAULT_AVATAR)image.src=DEFAULT_AVATAR}
const date = formatDateTime
const chatQuote = inject<{ enabled: Ref<boolean>; insert: (source: BreezemoonQuoteSource) => void } | null>('quoteBreezemoonInChat', null)
function share(item: FollowingMoon, event: MouseEvent | DragEvent) {
  const target = event.currentTarget as HTMLElement
  const body = target.closest('li')?.querySelector<HTMLElement>('.moon-body')
  const excerpt = body?.innerText.trim() || (body?.querySelector('img:not(.emoji)') ? '图片动态' : '')
  const source: BreezemoonQuoteSource = {
    id: item.id,
    userName: item.author.userName,
    nickname: item.author.userNickname,
    excerpt,
  }
  if ('dataTransfer' in event && event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/x-fishpi-breezemoon', JSON.stringify(source))
  } else {
    chatQuote?.insert(source)
  }
}
</script>
<template>
  <ul class="breezemoon-list" :class="{compact,'avatar-only':avatarOnly,'author-hidden':hideAuthor}"><li v-for="item in items" :key="item.id" :class="{ 'can-quote': chatQuote?.enabled.value }">
    <header><RouterLink v-if="!hideAuthor" :to="`/member/${encodeURIComponent(item.author.userName)}`" :data-user-card="item.author.userName" :aria-label="`查看 ${item.author.userNickname||item.author.userName} 的主页`"><img :src="avatarThumbnail(avatarUrl(item.author), avatarOnly || compact ? 20 : 28)" :data-user-card="item.author.userName" alt="" loading="lazy" @error="fallback" /><VipNickname v-if="!avatarOnly" :user-id="item.author.id" :user-name="item.author.userName" :text="item.author.userNickname||item.author.userName" /></RouterLink><time v-if="!avatarOnly" :datetime="timeISO(item.createdAt)">{{ date(item.createdAt) }}</time><slot name="actions" :item="item" /></header>
    <div class="moon-body" :draggable="chatQuote?.enabled.value" @dragstart="chatQuote?.enabled.value && share(item, $event)" v-html="item.contentHtml" />
    <button v-if="chatQuote?.enabled.value" type="button" class="moon-share" draggable="true"
      aria-label="引用到聊天室" title="引用到聊天室" @dragstart="share(item, $event)" @click="share(item, $event)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 10 5 14l4 4M5 14h10a4 4 0 0 0 4-4V6" />
      </svg>
    </button>
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
  border-radius: var(--fp-avatar-radius);
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
    border-radius: var(--fp-avatar-radius);
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
.avatar-only {
  gap: 0;
  li { display: grid; grid-template-columns: 20px minmax(0,1fr); align-items: start; column-gap: 7px; padding: 6px 0; }
  li.can-quote { grid-template-columns: 20px minmax(0,1fr) 28px; }
  header { grid-column: 1; grid-row: 1; margin-top: 1px; }
  header a { display: block; }
  header img { display: block; width: 20px; height: 20px; border-radius: var(--fp-avatar-radius-small); }
  .moon-body { grid-column: 2; grid-row: 1; margin: 0; padding: 0; font-size: 12px; line-height: 1.45; }
}
.moon-share {
  display: grid;
  place-items: center;
  grid-column: 3;
  grid-row: 1;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--fp-muted);
  cursor: pointer;

  svg { width: 16px; height: 16px; }
  &:hover, &:focus-visible { background: var(--fp-hover); color: var(--fp-text); }
  &:focus-visible { outline: 2px solid var(--fp-link); outline-offset: 1px; }
  &:active { cursor: grabbing; }
}

.author-hidden {
  gap:0;
  li { display:flex; flex-direction:column; padding:18px 4px; border:0; border-bottom:1px solid var(--fp-divider); border-radius:0; background:transparent; }
  li:last-child { border-bottom:0; }
  header { order:1; margin-top:10px; color:var(--fp-muted); font-size:12px; }
  time { margin-left:0; margin-right:auto; }
  .moon-body { margin:0; padding:0; font-size:14px; }
}
</style>
