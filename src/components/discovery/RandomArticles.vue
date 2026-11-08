<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { ArticleSummary } from '@/api/fishpi'
import { useDiscoveryExtras } from '@/composables/useDiscoveryExtras'
import { DEFAULT_AVATAR } from '@/utils/avatar'
import { articleTitle } from '@/utils/text'

const props = withDefaults(defineProps<{ size?: number; excludeId?: string }>(), { size: 8, excludeId: '' })
const { value, loading, error, read } = useDiscoveryExtras('random', computed(() => props.size), computed(() => props.excludeId))
const list = computed(() => value.value?.kind === 'random' ? value.value.list : null)
const hasAuthor = (article: ArticleSummary): article is ArticleSummary & { articleAuthorName: string } => article.articleAnonymous !== 1 && !!article.articleAuthorId && !!article.articleAuthorName

function fallback(event: Event) {
  const image = event.currentTarget as HTMLImageElement
  if (image.getAttribute('src') !== DEFAULT_AVATAR) image.src = DEFAULT_AVATAR
}
</script>

<template>
  <section class="random-discovery" :aria-busy="loading" aria-label="随机发现">
    <header class="discovery-head">
      <h2>
        <span class="discovery-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
          </svg>
        </span>
        随机发现
      </h2>
      <button class="shuffle-button" type="button" :disabled="loading" @click="read()">
        <svg :class="{ spinning: loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg>
        换一批文章
      </button>
    </header>
    <div v-if="loading" role="status">
      <span class="loading-label">正在读取随机发现…</span>
      <div class="discovery-grid" aria-hidden="true">
        <div v-for="index in size" :key="index" class="discovery-row skeleton"><span /><i /></div>
      </div>
    </div>
    <div v-else-if="error" class="discovery-state" role="alert">
      <p>{{ error }}</p><button class="shuffle-button" type="button" @click="read()">重试随机发现</button>
    </div>
    <ul v-else-if="list?.length" class="discovery-grid">
      <li v-for="article in list" :key="article.oId" class="discovery-row">
        <RouterLink v-if="hasAuthor(article)" class="author-avatar" :to="`/member/${encodeURIComponent(article.articleAuthorName)}`" :data-user-card="article.articleAuthorName" tabindex="-1" aria-hidden="true">
          <img :src="article.articleAuthorThumbnailURL48 || DEFAULT_AVATAR" alt="" loading="lazy" @error="fallback" />
        </RouterLink>
        <span v-else class="author-avatar anonymous-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="3" /><path d="M6 19v-1a6 6 0 0 1 12 0v1" /></svg>
        </span>
        <div class="discovery-copy">
          <RouterLink class="discovery-title" :to="`/article/${article.oId}`">{{ articleTitle(article) }}</RouterLink>
          <RouterLink v-if="hasAuthor(article)" class="discovery-author" :to="`/member/${encodeURIComponent(article.articleAuthorName)}`" :data-user-card="article.articleAuthorName">{{ article.articleAuthorNickname || article.articleAuthorName }}</RouterLink>
          <span v-else class="discovery-author">匿名用户</span>
        </div>
      </li>
    </ul>
    <p v-else-if="list" class="discovery-state">暂无可见推荐。</p>
    <p v-else class="discovery-state" role="status">随机发现尚未读取。</p>
  </section>
</template>

<style scoped lang="scss">
.random-discovery { padding: 16px 18px; container-type: inline-size; }
.discovery-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
h2 { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--fp-title); font-size: 16px; }
.discovery-icon { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; background: var(--fp-accent-soft); color: var(--fp-accent); }
.discovery-icon svg, .shuffle-button svg { width: 15px; height: 15px; }
.shuffle-button {
  display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px;
  border: 1px solid var(--fp-border); border-radius: 7px; background: var(--fp-card);
  color: var(--fp-muted); font: inherit; font-size: 12px; cursor: pointer;
  &:hover:not(:disabled) { background: var(--fp-hover); color: var(--fp-title); }
  &:disabled { opacity: .65; cursor: wait; }
}
.discovery-grid { display: grid; gap: 6px 10px; list-style: none; margin: 0; padding: 0; }
@container (min-width: 520px) { .discovery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.discovery-row {
  display: grid; grid-template-columns: 26px minmax(0, 1fr); align-items: center;
  gap: 9px; min-height: 52px; padding: 6px 9px; border-radius: 8px;
  background: var(--fp-surface-subtle); box-sizing: border-box;
  &:hover, &:focus-within { background: var(--fp-hover); }
}
.author-avatar { display: grid; place-items: center; width: 26px; height: 26px; border-radius: var(--fp-avatar-radius); overflow: hidden; }
.author-avatar img { width: 100%; height: 100%; object-fit: cover; }
.anonymous-avatar { background: var(--fp-card); color: var(--fp-muted); }
.anonymous-avatar svg { width: 16px; height: 16px; }
.discovery-copy { display: grid; gap: 2px; min-width: 0; }
.discovery-title, .discovery-author { width: fit-content; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.discovery-title { color: var(--fp-title); font-size: 14px; font-weight: 600; }
.discovery-author { color: var(--fp-muted); font-size: 11px; }
.discovery-title:hover, a.discovery-author:hover { text-decoration: underline; text-underline-offset: 3px; }
.discovery-title:hover { color: var(--fp-title); }
a.discovery-author:hover { color: var(--fp-muted); }
.discovery-state { margin: 0; padding: 12px 8px; color: var(--fp-muted); font-size: 13px; }
.discovery-state p { margin: 0 0 7px; color: var(--fp-danger); }
.loading-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.skeleton span, .skeleton i { background: var(--fp-divider); border-radius: 5px; height: 12px; }
.skeleton span { height: 26px; border-radius: var(--fp-avatar-radius); }
.skeleton i { width: 75%; }
.spinning { animation: discovery-spin .8s linear infinite; }
@keyframes discovery-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinning { animation: none; } }
</style>
