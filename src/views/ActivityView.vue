<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchRandomArticles, fetchRecentRegister, type ArticleSummary, type LiteUser } from '@/api/fishpi'
import CheckinPanel from '@/components/home/CheckinPanel.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'

usePageSeo(() => ({
  title: '活动中心',
  path: '/activity',
  description: '摸鱼派签到、昨日活跃奖励与发现',
}))

const auth = useAuthStore()
const { apiKey, isLoggedIn } = storeToRefs(auth)
const randoms = ref<ArticleSummary[]>([])
const recent = ref<LiteUser[]>([])
const error = ref('')

async function loadExtra() {
  error.value = ''
  try {
    ;[randoms.value, recent.value] = await Promise.all([
      fetchRandomArticles(8, apiKey.value),
      fetchRecentRegister(apiKey.value),
    ])
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  }
}

onMounted(() => void loadExtra())
watch(apiKey, () => void loadExtra())
</script>

<template>
  <div class="page">
    <section class="card">
      <h1>活动中心</h1>
      <p class="hint">签到与昨日活跃奖励；未登录仅可浏览推荐内容。</p>
      <CheckinPanel v-if="isLoggedIn" />
      <p v-else class="hint">
        <RouterLink :to="{ path: '/login', query: { redirect: '/activity' } }">登录</RouterLink>
        后可签到与领取奖励。
      </p>
    </section>

    <section class="card">
      <h2>随机发现</h2>
      <p v-if="error" class="err">{{ error }}</p>
      <ul v-else class="feed">
        <li v-if="!randoms.length" class="hint">暂无推荐</li>
        <li v-for="a in randoms" :key="a.oId">
          <RouterLink :to="`/article/${a.oId}`">{{ a.articleTitleEmoj || a.articleTitle }}</RouterLink>
          <span v-if="a.articleAuthorName">
            ·
            <RouterLink :to="`/member/${a.articleAuthorName}`">{{ a.articleAuthorName }}</RouterLink>
          </span>
        </li>
      </ul>
    </section>

    <section class="card">
      <h2>最近注册</h2>
      <ul class="people">
        <li v-if="!recent.length" class="hint">暂无数据</li>
        <li v-for="u in recent" :key="u.oId || u.userName">
          <img v-if="u.userAvatarURL" class="fp-avatar" :src="u.userAvatarURL" alt="" />
          <RouterLink :to="`/member/${u.userName}`">{{ u.userNickname || u.userName }}</RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.page {
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
h1,
h2 {
  margin: 0 0 10px;
  font-size: 18px;
  color: var(--fp-title);
}
h2 {
  font-size: 16px;
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.err {
  color: #e07a5f;
}
.feed,
.people {
  list-style: none;
  margin: 0;
  padding: 0;
}
.feed li,
.people li {
  padding: 8px 0;
  border-bottom: 1px solid var(--fp-border);
  font-size: 14px;
}
.people li {
  display: flex;
  align-items: center;
  gap: 10px;
}
.fp-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}
a {
  color: var(--fp-link);
  text-decoration: none;
}
span {
  color: var(--fp-muted);
  font-size: 13px;
}
</style>
