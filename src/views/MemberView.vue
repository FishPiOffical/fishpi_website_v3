<script setup lang="ts">
import { formatDisplayTime } from '@/utils/time'

import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useMemberPage } from '@/composables/useMemberPage'
import { usePageSeo } from '@/composables/usePageSeo'
import ArticleFeed from '@/components/articles/ArticleFeed.vue'
import { commentLink } from '@/api/v3-comment-location'
import BreezemoonList from '@/components/breezemoons/BreezemoonList.vue'
import PublicProfessions from '@/components/profession/PublicProfessions.vue'
import VipNickname from '@/components/user/VipNickname.vue'
import UserFollowButton from '@/components/user/UserFollowButton.vue'
import ReportDialog from '@/components/ReportDialog.vue'
import PointTransfer from '@/components/settings/PointTransfer.vue'
import { avatarStyle, avatarUrl, DEFAULT_AVATAR } from '@/utils/avatar'
function onAvatarError(event: Event) {
  const image = event.currentTarget as HTMLImageElement | null
  if (image && image.getAttribute('src') !== DEFAULT_AVATAR) image.src = DEFAULT_AVATAR
}
const route = useRoute(), auth = useAuthStore(), userName = computed(() => String(route.params.userName || ''))
const activeTab = computed(() => String(route.meta.memberTab || 'home')), moonId = computed(() => String(route.params.breezemoonId || ''))
const { profile, profileError, profileLoading, content, moon, contentError, contentLoading, p, readProfile, readContent } = useMemberPage(userName, activeTab, moonId)
const base = computed(() => `/member/${encodeURIComponent(userName.value)}`), viewSelf = computed(() => !!profile.value && auth.account?.oId === profile.value.id)
const showTransfer = ref(false), panel = ref<HTMLElement | null>(null)
watch([userName, () => auth.account?.oId, () => auth.accessToken], () => { showTransfer.value = false })
let lastPage = 1
watch(content, data => { if (!data) return; const moved = lastPage !== data.p; lastPage = data.p; if (moved) void nextTick(() => { if (content.value === data) panel.value?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }) }) })

usePageSeo(() => ({ title: `${profile.value?.userNickname || userName.value} 的主页`, description: profile.value?.userIntro || `${userName.value} 在摸鱼派的个人主页`, path: route.path, image: profile.value?.userAvatarURL, type: 'profile' }))
</script>
<template>
  <div class="member-page fp-page fp-page--wide fp-ui">
    <aside class="member-profile">
      <p v-if="profileLoading" role="status" class="member-status">正在读取用户资料…</p>
      <div v-if="profileError" role="alert" class="member-alert">
        <p>{{ profileError }}</p>
        <button class="fp-control" type="button" @click="readProfile">重试用户资料</button>
      </div>
      <template v-else-if="profile">
        <div class="soft-bg" aria-hidden="true">
          <div class="soft-bg-img" :style="avatarStyle(avatarUrl(profile))" />
          <div class="soft-bg-overlay" />
        </div>
        <div class="profile-body">
          <div class="avatar-stage">
            <img :key="avatarUrl(profile)" class="member-avatar" :src="avatarUrl(profile)" alt="" :data-user-card="profile.userName" @error="onAvatarError" />
          </div>
          <div class="identity-head">
            <h1 class="fp-page-title"><VipNickname :user-id="profile.id" :user-name="profile.userName" :text="profile.userNickname || profile.userName" /></h1>
            <p class="handle-pill">@{{ profile.userName }}</p>
          </div>
          <p v-if="profile.userIntro" class="intro">{{ profile.userIntro }}</p>
          <a v-if="profile.userURL" :href="profile.userURL" target="_blank" rel="noopener noreferrer" class="user-site-link">🔗 个人主页</a>
          <div v-if="auth.isLoggedIn" class="member-actions">
            <RouterLink v-if="viewSelf" to="/settings" class="action-link action-link--primary">编辑资料</RouterLink>
            <template v-else>
              <UserFollowButton :user-name="profile.userName" :user-id="profile.id" />
              <RouterLink :to="`/chat?toUser=${encodeURIComponent(profile.userName)}`" class="action-link">发私信</RouterLink>
              <button class="fp-control" type="button" @click="showTransfer = !showTransfer">转账</button>
              <ReportDialog :data-id="profile.id" :data-type="2" />
            </template>
          </div>
        </div>
      </template>
      <p v-else-if="!profileLoading && !profileError" role="status" class="member-status">用户资料尚未读取。</p>
    </aside>
    <PointTransfer v-if="showTransfer && profile && auth.isLoggedIn && !viewSelf" :initial-recipient="profile.userName" />
    <main ref="panel" class="member-content">

      <PublicProfessions v-if="activeTab === 'profession'" :user-name="userName" />
      <p v-else-if="activeTab === 'points'" class="member-status">积分流水仅本人可在<RouterLink to="/points">我的积分</RouterLink>查看。</p>
      <template v-else>
        <div class="content-section-head">
          <h2>{{ activeTab === 'long' ? '长文章' : activeTab === 'comments' ? '公开回帖' : activeTab === 'breezemoons' ? '清风明月' : '公开帖子' }}</h2>
          <span v-if="content" class="content-total-badge">共 {{ content.total }} 条</span>
        </div>
        <button type="button" class="refresh-member-btn fp-control" :disabled="contentLoading" @click="readContent()">刷新用户内容</button>
        <p v-if="contentLoading" role="status" class="member-status">正在读取用户内容…</p>
        <div v-else-if="contentError" role="alert" class="member-alert">
          <p>{{ contentError }}</p>
          <button class="fp-control" type="button" @click="readContent()">重试用户内容</button>
          <button class="fp-control" v-if="p > 1" type="button" @click="readContent(1)">返回第一页</button>
        </div>
        <template v-else-if="moon">
          <BreezemoonList :items="[moon]" />
          <div class="moon-back-bar">
            <RouterLink :to="`${base}/breezemoons`" class="action-link">查看全部清风明月</RouterLink>
          </div>
        </template>
        <template v-else-if="content">
          <ArticleFeed v-if="activeTab === 'home' || activeTab === 'long'" :items="content.articles" empty="本页没有可见文章" />
          <BreezemoonList v-else-if="activeTab === 'breezemoons'" :items="content.moons">
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
              <p v-else class="comment-private">私密评论正文不可见。</p>
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
  </div>
</template>
<style scoped lang="scss">
.member-page {
  display: grid;
  grid-template-columns: 296px minmax(0, 1fr);
  gap: var(--fp-page-gap, 18px);
  align-items: start;
}

.member-profile {
  position: sticky;
  top: calc(var(--fp-nav-h) + 14px);
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius);
  box-shadow: var(--fp-card-shadow);
  overflow: hidden;
  overflow-wrap: anywhere;

  .soft-bg {
    position: relative;
    height: 112px;
    overflow: hidden;
    background: linear-gradient(135deg, color-mix(in srgb, var(--fp-accent) 22%, var(--fp-surface-subtle)), var(--fp-surface-subtle));

    .soft-bg-img {
      position: absolute;
      inset: -24px;
      background-size: cover;
      background-position: center;
      filter: blur(22px) saturate(1.25);
      opacity: 0.42;
      transform: scale(1.12);
    }

    .soft-bg-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom, rgba(15, 23, 42, 0.04), var(--fp-card));
    }
  }

  .profile-body {
    position: relative;
    padding: 0 20px 22px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .avatar-stage {
    margin-top: -48px;
    margin-bottom: 10px;
    position: relative;
    z-index: 1;
  }

  .identity-head {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  h1 {
    font-size: 19px;
    font-weight: 700;
    margin: 0;
    color: var(--fp-title);
  }

  .handle-pill {
    margin: 0;
    font-size: 12px;
    color: var(--fp-muted);
    background: var(--fp-surface-subtle);
    border: 1px solid var(--fp-divider);
    padding: 2px 9px;
    border-radius: 999px;
  }

  .intro {
    margin: 12px 0 0;
    padding: 10px 12px;
    width: 100%;
    font-size: 13px;
    line-height: 1.55;
    color: var(--fp-text);
    background: var(--fp-surface-subtle);
    border: 1px solid var(--fp-divider);
    border-radius: 10px;
    white-space: pre-wrap;
    text-align: left;
  }

  .user-site-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 10px;
    font-size: 12.5px;
    color: var(--fp-link);
    background: var(--fp-surface-subtle);
    border: 1px solid var(--fp-divider);
    padding: 4px 12px;
    border-radius: 999px;
    text-decoration: none;

    &:hover {
      border-color: var(--fp-accent);
      color: var(--fp-accent);
    }
  }
}

.member-avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--fp-card);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.14);
  background: var(--fp-card);
}

.member-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding-top: 14px;
  width: 100%;
  border-top: 1px solid var(--fp-divider);

  .action-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
    padding: 5px 12px;
    border-radius: 8px;
    border: 1px solid var(--fp-border);
    background: var(--fp-card);
    color: var(--fp-text);
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.16s ease;

    &:hover {
      border-color: var(--fp-accent);
      color: var(--fp-title);
    }

    &--primary {
      background: color-mix(in srgb, var(--fp-accent) 14%, var(--fp-card));
      border-color: color-mix(in srgb, var(--fp-accent) 42%, var(--fp-border));
      color: var(--fp-accent);
      font-weight: 600;
    }
  }
}

.member-content {
  min-width: 0;
  scroll-margin-top: 88px;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius);
  box-shadow: var(--fp-card-shadow);
  padding: 20px 24px;

  .refresh-member-btn {
    display: none;
  }
}

.content-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;

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
    background: var(--fp-surface-subtle);
    border: 1px solid var(--fp-divider);
    border-radius: 10px;
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
      color: var(--fp-accent);
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
  .member-page {
    grid-template-columns: minmax(0, 1fr);
  }
  .member-profile {
    position: static;
  }
  .member-content {
    padding: 16px;
  }
}
</style>
