<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { ArticleSummary } from '@/api/fishpi'

const props = withDefaults(
  defineProps<{
    items: ArticleSummary[]
    empty?: string
    compact?: boolean
  }>(),
  {
    empty: '暂无帖子',
    compact: false,
  },
)

const rows = computed(() => props.items)

function titleOf(a: ArticleSummary) {
  return a.articleTitleEmoj || a.articleTitle || '无标题'
}

function views(a: ArticleSummary) {
  return a.articleViewCntDisplayFormat || a.articleViewCount || 0
}

function splitTags(a: ArticleSummary): string[] {
  if (a.articleTagObjs?.length) return a.articleTagObjs.map((t) => t.tagTitle)
  if (!a.articleTags) return []
  return a.articleTags
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function avatarOf(a: ArticleSummary) {
  return a.articleAuthorThumbnailURL48 || a.articleAuthorThumbnailURL20 || ''
}
</script>

<template>
  <div class="article-feed-wrap">
    <ol v-if="compact" class="feed compact">
      <li v-if="!rows.length" class="empty">{{ empty }}</li>
      <li v-for="item in rows" :key="item.oId" class="compact-item">
        <span v-if="item.articleStick" class="cb-stick" title="置顶" />
        <RouterLink
          v-if="item.articleAuthorName"
          :to="`/member/${item.articleAuthorName}`"
          class="compact-avatar-link"
        >
          <span
            class="avatar-small"
            :style="avatarOf(item) ? { backgroundImage: `url('${avatarOf(item)}')` } : undefined"
            :aria-label="item.articleAuthorName"
          />
        </RouterLink>
        <RouterLink class="title fn-ellipsis" :to="`/article/${item.oId}`">{{ titleOf(item) }}</RouterLink>
        <span class="count">{{ views(item) }}</span>
      </li>
    </ol>

    <ul v-else class="feed full">
      <li v-if="!rows.length" class="empty">{{ empty }}</li>
      <li v-for="item in rows" :key="item.oId" class="feed-item">
        <span v-if="item.articleStick" class="cb-stick" title="置顶" />

        <!-- 顶部标签与回帖/浏览统计行 -->
        <div class="item-header fn-clear">
          <div class="tags-row">
            <template v-for="tag in splitTags(item)" :key="tag">
              <RouterLink :to="`/tag/${encodeURIComponent(tag)}`" class="tag-link">
                {{ tag }}
              </RouterLink>
            </template>
          </div>
          <div class="stats-row">
            <RouterLink :to="`/article/${item.oId}#comments`" class="stat-pill stat-cmt">
              <b>{{ item.articleCommentCount ?? 0 }}</b> 回帖
            </RouterLink>
            <span class="stat-sep">•</span>
            <span class="stat-pill stat-view">
              {{ views(item) }} 浏览
            </span>
          </div>
        </div>

        <!-- 标题行 -->
        <h2 class="item-title">
          <span v-if="item.articlePerfect" class="icon-perfect" title="优选">🌟</span>
          <RouterLink class="title-link" :to="`/article/${item.oId}`">
            {{ titleOf(item) }}
          </RouterLink>
          <RouterLink
            v-if="item.columnTitle && item.columnId"
            :to="`/column/${item.columnId}`"
            class="column-pill"
          >
            专栏 · {{ item.columnTitle }}
          </RouterLink>
        </h2>

        <!-- 作者与时间行 -->
        <div class="item-author-row">
          <RouterLink
            v-if="item.articleAuthorName"
            :to="`/member/${item.articleAuthorName}`"
            class="author-avatar"
          >
            <span
              class="avatar-img"
              :style="avatarOf(item) ? { backgroundImage: `url('${avatarOf(item)}')` } : undefined"
              :aria-label="item.articleAuthorName"
            />
          </RouterLink>
          <div class="author-meta fn-ellipsis">
            <div class="author-line">
              <RouterLink
                v-if="item.articleAuthorName"
                :to="`/member/${item.articleAuthorName}`"
                class="author-name"
              >
                {{ item.articleAuthorName }}
              </RouterLink>
              <span v-if="item.articleAuthorIntro" class="author-intro">
                - {{ item.articleAuthorIntro }}
              </span>
            </div>
            <div class="time-line">
              <template v-if="item.articleLatestCmterName">
                <span class="time-label">最新回复来自</span>
                <RouterLink
                  :to="`/member/${item.articleLatestCmterName}`"
                  class="latest-cmter"
                >
                  {{ item.articleLatestCmterName }}
                </RouterLink>
                <span class="time-ago">{{ item.articleLatestCmtTimeAgo || item.timeAgo }}</span>
              </template>
              <template v-else>
                <span class="time-ago">{{ item.timeAgo || item.articleCreateTimeStr || '刚刚' }}</span>
              </template>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.article-feed-wrap {
  width: 100%;
}

.feed {
  list-style: none;
  margin: 0;
  padding: 0;
}

.empty {
  padding: 36px 16px;
  text-align: center;
  color: var(--fp-muted);
  font-size: 14px;
}

/* 完整模式列表 (对齐现网 Rhythm common/list-item.ftl) */
.feed.full .feed-item {
  position: relative;
  padding: 14px 18px;
  border-bottom: 1px solid var(--fp-border);
  transition: background-color 0.15s ease;
}

.feed.full .feed-item:last-child {
  border-bottom: none;
}

.feed.full .feed-item:hover {
  background-color: var(--fp-hover);
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  margin-bottom: 6px;
}

.tags-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.tag-link {
  color: var(--fp-head);
  text-decoration: none;
  background: var(--fp-hover);
  padding: 1px 7px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 18px;
  transition: all 0.15s ease;
}

.tag-link:hover {
  color: var(--fp-link);
  background: rgba(66, 133, 244, 0.1);
}

.stats-row {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--fp-muted);
  font-size: 12px;
  white-space: nowrap;
}

.stat-pill {
  color: var(--fp-head);
  text-decoration: none;
}

.stat-cmt b {
  color: var(--fp-accent);
  font-weight: 600;
}

.stat-sep {
  opacity: 0.5;
}

.item-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.45;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
}

.icon-perfect {
  font-size: 14px;
}

.title-link {
  color: var(--fp-title);
  text-decoration: none;
  transition: color 0.15s ease;
}

.title-link:hover {
  color: var(--fp-link);
}

.column-pill {
  display: inline-block;
  font-size: 12px;
  font-weight: 400;
  padding: 1px 7px;
  border-radius: 10px;
  background: #eef4ff;
  color: #2b5db9;
  text-decoration: none;
  line-height: 18px;
  vertical-align: middle;
}

.item-author-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.author-avatar {
  flex-shrink: 0;
  display: block;
}

.avatar-img {
  display: block;
  width: 36px;
  height: 36px;
  border-radius: 4px;
  background: var(--fp-hover) center / cover no-repeat;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.author-meta {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.4;
}

.author-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.author-name {
  color: var(--fp-text);
  font-weight: 500;
  text-decoration: none;
}

.author-name:hover {
  color: var(--fp-link);
}

.author-intro {
  color: var(--fp-muted);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-line {
  color: var(--fp-muted);
  margin-top: 2px;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.time-label {
  opacity: 0.8;
}

.latest-cmter {
  color: var(--fp-head);
  text-decoration: none;
  font-weight: 500;
}

.latest-cmter:hover {
  color: var(--fp-link);
}

/* 紧凑模式 */
.feed.compact .compact-item {
  position: relative;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 9px 14px;
  font-size: 14px;
  border-bottom: 1px solid var(--fp-border);
  transition: background-color 0.15s ease;
}

.feed.compact .compact-item:last-child {
  border-bottom: none;
}

.feed.compact .compact-item:hover {
  background-color: var(--fp-hover);
}

.compact-avatar-link {
  flex-shrink: 0;
  display: flex;
}

.compact-item .title {
  flex: 1;
  color: var(--fp-title);
  text-decoration: none;
  font-size: 14px;
}

.compact-item .title:hover {
  color: var(--fp-link);
}

.compact-item .count {
  color: var(--fp-head);
  font-size: 12px;
  background: var(--fp-hover);
  padding: 1px 6px;
  border-radius: 9px;
}
</style>
