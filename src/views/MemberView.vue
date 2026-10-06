<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchUserArticles,
  fetchUserProfile,
  followUser,
  unfollowUser,
  type ArticleSummary,
  type UserProfile,
} from '@/api/fishpi'
import ArticleFeed from '@/components/articles/ArticleFeed.vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()
const { apiKey, account, isLoggedIn } = storeToRefs(auth)

const userName = computed(() => String(route.params.userName || ''))
const profile = ref<UserProfile | null>(null)
const articles = ref<ArticleSummary[]>([])
const loading = ref(true)
const error = ref('')
const actionMsg = ref('')
const usingMock = computed(() => String(profile.value?.oId || '').startsWith('mock-'))

const isSelf = computed(() => Boolean(account.value && account.value.userName === userName.value))
const following = computed(() => profile.value?.canFollow === 'no')

async function load() {
  if (!userName.value) return
  loading.value = true
  error.value = ''
  actionMsg.value = ''
  try {
    const [p, list] = await Promise.all([
      fetchUserProfile(userName.value, apiKey.value),
      fetchUserArticles(userName.value, apiKey.value),
    ])
    if (isSelf.value) p.canFollow = 'hide'
    profile.value = p
    articles.value = list
  } catch (e) {
    error.value = e instanceof Error ? e.message : '用户加载失败'
    profile.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => [userName.value, apiKey.value],
  () => void load(),
  { immediate: true },
)

async function toggleFollow() {
  if (!apiKey.value || !profile.value || isSelf.value) return
  actionMsg.value = ''
  try {
    if (following.value) await unfollowUser(apiKey.value, profile.value.oId)
    else await followUser(apiKey.value, profile.value.oId)
    await load()
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '操作失败'
  }
}
</script>

<template>
  <p v-if="loading" class="hint">加载用户…</p>
  <p v-else-if="error" class="err">{{ error }}</p>
  <div v-else-if="profile" class="member">
    <section class="card hero">
      <img v-if="profile.userAvatarURL" class="fp-avatar" :src="profile.userAvatarURL" alt="" />
      <div>
        <h1>{{ profile.userNickname || profile.userName }}</h1>
        <p class="meta">@{{ profile.userName }} · {{ profile.userAppRole === 1 ? '画家' : '黑客' }}</p>
        <p v-if="profile.userIntro" class="intro">{{ profile.userIntro }}</p>
        <p class="stats">
          <span>{{ profile.userArticleCount ?? articles.length }} 帖</span>
          <span>{{ profile.userCommentCount ?? 0 }} 评</span>
          <span>{{ profile.followingUserCount ?? 0 }} 关注</span>
          <span>{{ profile.userPoint ?? 0 }} 积分</span>
        </p>
        <p v-if="usingMock" class="hint">匿名用户接口未开放，当前为与 <code>GET /user/:userName</code> 对齐的 mock。</p>
        <p v-if="actionMsg" class="err">{{ actionMsg }}</p>
        <button
          v-if="isLoggedIn && !isSelf && profile.canFollow !== 'hide'"
          type="button"
          @click="toggleFollow"
        >
          {{ following ? '取消关注' : '关注' }}
        </button>
        <p v-else-if="!isLoggedIn" class="hint">
          <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>
          后可关注。
        </p>
      </div>
    </section>
    <section class="card">
      <h2>帖子</h2>
      <ArticleFeed :items="articles" empty="还没有公开帖子" />
    </section>
  </div>
</template>

<style scoped>
.member {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 18px 20px;
}
.hero {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.hero .fp-avatar {
  width: 72px;
  height: 72px;
}
h1 {
  margin: 0 0 4px;
  font-size: 20px;
}
h2 {
  margin: 0 0 10px;
  font-size: 15px;
}
.meta,
.intro,
.hint,
.stats {
  color: var(--fp-muted);
  font-size: 13px;
}
.stats {
  display: flex;
  gap: 12px;
}
.err {
  color: #e07a5f;
  font-size: 13px;
}
button {
  margin-top: 8px;
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 8px;
  padding: 6px 14px;
  cursor: pointer;
}
</style>
