<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchMembership,
  fetchPublicProfession,
  fetchUserArticles,
  fetchUserBreezemoons,
  fetchUserMedals,
  fetchUserProfile,
  followUser,
  transferPoints,
  unfollowUser,
  type ArticleSummary,
  type Breezemoon,
  type MetalItem,
  type PublicProfessionProfile,
  type UserProfile,
} from '@/api/fishpi'
import ArticleFeed from '@/components/articles/ArticleFeed.vue'
import MetalBadges from '@/components/MetalBadges.vue'
import ReportDialog from '@/components/ReportDialog.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeMemberPayload } from '@/seo/payload'
import { SITE_DEFAULT_DESC } from '@/seo/site'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()
const { apiKey, account, isLoggedIn, isVip } = storeToRefs(auth)

const userName = computed(() => String(route.params.userName || ''))
const profile = ref<UserProfile | null>(null)
const articles = ref<ArticleSummary[]>([])
const breezemoons = ref<Breezemoon[]>([])
const articlesMock = ref(false)
const loading = ref(true)
const error = ref('')
const actionMsg = ref('')
const sendAmount = ref(5)
const sendMemo = ref('请你吃鱼丸')
const transferring = ref(false)
const viewedVip = ref(false)
const profession = ref<PublicProfessionProfile | null>(null)
const extraMedals = ref<MetalItem[]>([])
const usingMock = computed(() => String(profile.value?.oId || '').startsWith('mock-'))

const isSelf = computed(() => Boolean(account.value && account.value.userName === userName.value))
const following = computed(() => profile.value?.canFollow === 'no')

usePageSeo(() => {
  const p = profile.value
  const name = p?.userNickname || p?.userName || userName.value
  return {
    title: name ? `${name} 的主页` : '用户主页',
    description: p?.userIntro || (name ? `${name} 在摸鱼派的个人主页` : SITE_DEFAULT_DESC),
    path: `/member/${userName.value}`,
    image: p?.userAvatarURL,
    type: 'profile',
  }
})

async function load() {
  if (!userName.value) return
  const cached = consumeMemberPayload(userName.value)
  loading.value = true
  error.value = ''
  actionMsg.value = ''
  try {
    if (cached) {
      profile.value = cached
      if (isSelf.value) profile.value.canFollow = 'hide'
    }
    const [p, list, moons] = await Promise.all([
      cached ? Promise.resolve(cached) : fetchUserProfile(userName.value, apiKey.value),
      import.meta.env.SSR ? Promise.resolve([] as ArticleSummary[]) : fetchUserArticles(userName.value, apiKey.value),
      import.meta.env.SSR
        ? Promise.resolve([] as Breezemoon[])
        : fetchUserBreezemoons(userName.value, apiKey.value, 1, 12),
    ])
    if (isSelf.value) p.canFollow = 'hide'
    profile.value = p
    articles.value = list
    articlesMock.value = list.some((a) => String(a.oId).startsWith('mock-'))
    breezemoons.value = moons
    viewedVip.value = false
    profession.value = null
    extraMedals.value = []
    if (!import.meta.env.SSR && p.oId && !String(p.oId).startsWith('mock-')) {
      try {
        viewedVip.value = (await fetchMembership(p.oId)).isVip
      } catch {
        viewedVip.value = isSelf.value && isVip.value
      }
      profession.value = await fetchPublicProfession(userName.value, apiKey.value)
      extraMedals.value = apiKey.value
        ? (await fetchUserMedals(apiKey.value, userName.value)).filter(
            (m) => m.name && !(p.sysMetal || []).some((s) => s.name === m.name),
          )
        : []
    }
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

async function sendPoints() {
  if (!apiKey.value || !profile.value || isSelf.value) return
  transferring.value = true
  actionMsg.value = ''
  try {
    await transferPoints(apiKey.value, profile.value.userName, Number(sendAmount.value), sendMemo.value)
    actionMsg.value = '转账成功'
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '转账失败'
  } finally {
    transferring.value = false
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
        <p class="meta">
          @{{ profile.userName }} · {{ profile.userAppRole === 1 ? '画家' : '黑客' }}
          <em v-if="viewedVip">VIP</em>
          <RouterLink
            v-if="profile.userCity"
            class="city"
            :to="`/city/${encodeURIComponent(profile.userCity)}`"
          >
            {{ profile.userCity }}
          </RouterLink>
        </p>
        <p v-if="profile.userIntro" class="intro">{{ profile.userIntro }}</p>
        <p class="stats">
          <span>{{ profile.userArticleCount ?? articles.length }} 帖</span>
          <span>{{ profile.userCommentCount ?? 0 }} 评</span>
          <RouterLink :to="`/member/${profile.userName}/following`">{{ profile.followingUserCount ?? 0 }} 关注</RouterLink>
          <RouterLink :to="`/member/${profile.userName}/followers`">{{ profile.followerCount ?? 0 }} 粉丝</RouterLink>
          <span>{{ profile.userPoint ?? 0 }} 积分</span>
        </p>
        <MetalBadges :items="profile.sysMetal" />
        <MetalBadges v-if="extraMedals.length" :items="extraMedals" />
        <p class="hint">
          <RouterLink :to="`/member/${profile.userName}/medals`">查看全部徽章</RouterLink>
        </p>
        <p v-if="profession?.primaryProfession" class="intro">
          职业 {{ profession.primaryProfession.displayName || profession.primaryProfession.shortName }}
          <span v-if="profession.primaryProfession.levelName"> · {{ profession.primaryProfession.levelName }}</span>
        </p>
        <ul v-if="profession?.professions?.length" class="jobs">
          <li v-for="job in profession.professions" :key="job.professionId || job.displayName">
            {{ job.displayName || job.shortName }}
            <em v-if="job.levelName">{{ job.levelName }}</em>
          </li>
        </ul>
        <p v-if="usingMock" class="hint">匿名用户接口未开放，当前为与 <code>GET /user/:userName</code> 对齐的 mock。</p>
        <p v-if="actionMsg" :class="actionMsg.includes('成功') ? 'ok' : 'err'">{{ actionMsg }}</p>
        <button
          v-if="isLoggedIn && !isSelf && profile.canFollow !== 'hide'"
          type="button"
          @click="toggleFollow"
        >
          {{ following ? '取消关注' : '关注' }}
        </button>
        <RouterLink v-if="isLoggedIn && isSelf" class="msg" to="/settings">编辑资料</RouterLink>
        <RouterLink v-if="isLoggedIn && !isSelf" class="msg" :to="`/chat/${profile.userName}`">发私信</RouterLink>
        <ReportDialog v-if="isLoggedIn && !isSelf" :api-key="apiKey" :data-id="profile.oId" :data-type="2" />
        <form v-if="isLoggedIn && !isSelf" class="xfer" @submit.prevent="sendPoints">
          <input v-model.number="sendAmount" type="number" min="1" />
          <input v-model="sendMemo" placeholder="备注" />
          <button type="submit" :disabled="transferring">{{ transferring ? '转账中…' : '转账' }}</button>
          <RouterLink class="msg" :to="`/settings/point?to=${encodeURIComponent(profile.userName)}`">转账页</RouterLink>
        </form>
        <p v-else-if="!isLoggedIn" class="hint">
          <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>
          后可关注。
        </p>
      </div>
    </section>
    <section class="card">
      <h2>帖子</h2>
      <p v-if="!isLoggedIn && !articles.length" class="hint">
        用户发帖列表需登录（<code>GET /api/user/:name/articles</code>）。
        <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">去登录</RouterLink>
      </p>
      <p v-else-if="articlesMock" class="hint">列表接口异常，暂无真实帖子数据。</p>
      <ArticleFeed :items="articles" empty="还没有公开帖子" />
    </section>
    <section v-if="breezemoons.length" class="card">
      <h2>清风明月</h2>
      <ul class="moons">
        <li v-for="m in breezemoons" :key="m.oId">
          <div class="cmt-body" v-html="m.breezemoonContent || ''" />
          <time>{{ m.timeAgo || '' }}</time>
        </li>
      </ul>
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
.meta a,
.hint a,
.stats a {
  color: var(--fp-link);
  text-decoration: none;
}
.meta .city {
  margin-left: 8px;
}
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.jobs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  font-size: 12px;
  color: var(--fp-muted);
}
.jobs em {
  margin-left: 4px;
  font-style: normal;
}
.moons {
  list-style: none;
  margin: 0;
  padding: 0;
}
.moons li {
  padding: 10px 0;
  border-bottom: 1px solid var(--fp-border);
}
.moons time {
  display: block;
  margin-top: 4px;
  color: var(--fp-muted);
  font-size: 12px;
}
.moons :deep(p) {
  margin: 0;
}
.err {
  color: #e07a5f;
  font-size: 13px;
}
.ok {
  color: var(--fp-primary);
  font-size: 13px;
}
.xfer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  align-items: center;
}
.xfer input {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 6px 8px;
  width: 120px;
}
button {
  margin-top: 8px;
  margin-right: 8px;
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 8px;
  padding: 6px 14px;
  cursor: pointer;
}
.msg {
  display: inline-block;
  margin-top: 8px;
  color: var(--fp-link);
  text-decoration: none;
}
</style>
