<script setup lang="ts">
import CommentVisibilityNotice from '@/components/comments/CommentVisibilityNotice.vue'
import { formatDisplayTime } from '@/utils/time'

import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useMemberPage } from '@/composables/useMemberPage'
import { usePageSeo } from '@/composables/usePageSeo'
import ArticleFeed from '@/components/articles/ArticleFeed.vue'
import { commentLink } from '@/api/v3-comment-location'
import BreezemoonList from '@/components/breezemoons/BreezemoonList.vue'
const route = useRoute(), userName = computed(() => String(route.params.userName || ''))
const activeTab = computed(() => String(route.meta.memberTab || 'home')), moonId = computed(() => String(route.params.breezemoonId || ''))
const { profile, content, moon, contentError, contentLoading, p, readContent } = useMemberPage(userName, activeTab, moonId)
const base = computed(() => `/member/${encodeURIComponent(userName.value)}`)
const panel = ref<HTMLElement | null>(null)
let lastPage = 1
watch(content, data => { if (!data) return; const moved = lastPage !== data.p; lastPage = data.p; if (moved) void nextTick(() => { if (content.value === data) panel.value?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }) }) })

usePageSeo(() => ({ title: `${profile.value?.userNickname || userName.value} 的主页`, description: profile.value?.userIntro || `${userName.value} 在摸鱼派的个人主页`, path: route.path, image: profile.value?.userAvatarURL, type: 'profile' }))
</script>
<template>
    <main ref="panel" class="member-content">

      <p v-if="activeTab === 'points'" class="member-status">积分流水仅本人可在<RouterLink to="/points">我的积分</RouterLink>查看。</p>
      <template v-else>
        <div class="content-section-head">
          <span v-if="content" class="content-total-badge">共 {{ content.total }} 条</span>
          <button type="button" class="refresh-member-btn fp-control" :disabled="contentLoading" aria-label="刷新用户内容" @click="readContent()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg>刷新</button>
        </div>
        <p v-if="contentLoading" role="status" class="member-status">正在读取用户内容…</p>
        <div v-else-if="contentError" role="alert" class="member-alert">
          <p>{{ contentError }}</p>
          <button class="fp-control" type="button" @click="readContent()">重试用户内容</button>
          <button class="fp-control" v-if="p > 1" type="button" @click="readContent(1)">返回第一页</button>
        </div>
        <template v-else-if="moon">
          <BreezemoonList :items="[moon]" hide-author />
          <div class="moon-back-bar">
            <RouterLink :to="`${base}/breezemoons`" class="action-link">查看全部清风明月</RouterLink>
          </div>
        </template>
        <template v-else-if="content">
          <ArticleFeed v-if="activeTab === 'home' || activeTab === 'long'" :items="content.articles" hide-author empty="本页没有可见文章" />
          <BreezemoonList v-else-if="activeTab === 'breezemoons'" :items="content.moons" hide-author>
            <template #actions="{ item }">
              <RouterLink :to="`${base}/breezemoons/${item.id}`">查看这条清风</RouterLink>
            </template>
          </BreezemoonList>
          <ul v-else class="member-comments">
            <li v-for="item in content.comments" :key="item.id">
              <div class="comment-card-head">
                <RouterLink :to="commentLink(item.articleId,item.id)" class="comment-article-link">{{ item.article.articleTitle }}</RouterLink>
                <time :datetime="item.comment.commentCreateTimeStr">{{ formatDisplayTime(item.comment.commentCreateTimeStr) }}</time>
              </div>
              <div v-if="item.comment.commentContentVisible" class="comment-body" v-html="item.comment.commentContent" />
              <CommentVisibilityNotice v-else />
            </li>
          </ul>
          <p v-if="!content.total && activeTab !== 'home' && activeTab !== 'long'" class="member-status">没有可见记录。</p>
          <div class="member-pager fp-pagination">
            <button class="fp-control" type="button" :disabled="p <= 1" @click="readContent(p - 1)">上一页用户内容</button>
            <span>第 {{ p }} 页 / 共 {{ content.pageCount }} 页</span>
            <button class="fp-control" type="button" :disabled="p >= content.pageCount" @click="readContent(p + 1)">下一页用户内容</button>
          </div>
        </template>
        <p v-else role="status" class="member-status">用户内容尚未读取。</p>
      </template>
    </main>
</template>
<style scoped lang="scss">
.member-content {
  min-width: 0;
  scroll-margin-top: 88px;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius);
  box-shadow: var(--fp-card-shadow);
  padding: 20px 24px;

  .refresh-member-btn {
    display: inline-flex; align-items:center; gap:6px; margin-left:auto; font-size:12px;
    svg { width:15px; height:15px; }
  }
}

.content-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 0;
  padding-bottom:12px;
  border-bottom:1px solid var(--fp-divider);

  h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    color: var(--fp-title);
  }

  .content-total-badge {
    font-size: 12px;
    font-weight: 600;
    color: var(--fp-muted);
    background: var(--fp-surface-subtle);
    border: 1px solid var(--fp-divider);
    padding: 3px 10px;
    border-radius: 999px;
  }
}

a {
  color: var(--fp-link);
  text-decoration: none;
}

p,
time {
  color: var(--fp-muted);
}

button {
  padding: 6px 12px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-card);
  color: var(--fp-text);
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

.member-status {
  padding: 20px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--fp-muted);
}

.member-alert,
[role='alert'] {
  padding: 14px 16px;
  border-radius: 10px;
  background: rgba(195, 74, 54, 0.08);
  border: 1px solid rgba(195, 74, 54, 0.24);
  color: var(--fp-danger);
}

.member-comments {
  list-style: none;
  margin: 12px 0 16px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;

  li {
    padding: 14px 16px;
    background: transparent;
    border: 0;
    border-bottom: 1px solid var(--fp-divider);
    border-radius: 0;
    transition: border-color 0.16s ease;

    &:hover {
      border-color: var(--fp-border);
    }
  }

  .comment-card-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px dashed var(--fp-divider);
  }

  .comment-article-link {
    font-size: 14px;
    font-weight: 600;
    color: var(--fp-title);

    &:hover {
      text-decoration: underline;
    }
  }

  time {
    font-size: 12px;
    color: var(--fp-muted);
    margin: 0;
  }
}

.comment-body {
  font-size: 13.5px;
  line-height: 1.65;
  color: var(--fp-text);
  overflow-wrap: anywhere;
  overflow: auto;

  :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
  }

  :deep(pre) {
    overflow: auto;
  }
}

.comment-private {
  margin: 0;
  font-size: 13px;
  font-style: italic;
}

.member-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--fp-divider);
}

@media (max-width: 900px) {
  .member-content { padding:16px; }
}
</style>
