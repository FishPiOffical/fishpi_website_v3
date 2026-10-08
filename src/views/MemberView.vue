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

// SSR / 客户端首屏：先吃掉 prefetch，避免一直停在「加载用户」
const bootProfile = consumeMemberPayload(String(route.params.userName || ''))
const profile = ref<UserProfile | null>(bootProfile)
const articles = ref<ArticleSummary[]>([])
const breezemoons = ref<Breezemoon[]>([])
const articlesMock = ref(false)
const loading = ref(!bootProfile)
const error = ref('')
const actionMsg = ref('')
const sendAmount = ref(10)
const sendMemo = ref('请你吃鱼丸')
const transferring = ref(false)
const showTransfer = ref(false)
const viewedVip = ref(false)
const profession = ref<PublicProfessionProfile | null>(null)
const extraMedals = ref<MetalItem[]>([])
const activeTab = ref<'articles' | 'moons' | 'medals' | 'profession'>('articles')

const usingMock = computed(() => String(profile.value?.oId || '').startsWith('mock-'))
const isSelf = computed(() => Boolean(account.value && account.value.userName === userName.value))
const following = computed(() => profile.value?.canFollow === 'no')

const allMedals = computed(() => {
  const sys = profile.value?.sysMetal || []
  const extra = extraMedals.value || []
  return [...sys, ...extra]
})

const roleBadgeSrc = computed(() => {
  const role = profile.value?.userRole || ''
  if (role.includes('admin') || role === '管理员') return 'https://file.fishpi.cn/adminRole.png'
  if (role.includes('op') || role === 'OP') return 'https://file.fishpi.cn/opRole.png'
  if (role.includes('police') || role === '纪律委员') return 'https://file.fishpi.cn/policeRole.png'
  if (viewedVip.value) return 'https://file.fishpi.cn/svipRole.png'
  if (role.includes('vip') || role === '成员') return 'https://file.fishpi.cn/vipRole.png'
  return 'https://file.fishpi.cn/newRole.png'
})

const pointHex = computed(() => {
  const pts = profile.value?.userPoint ?? 0
  return pts.toString(16).toUpperCase()
})

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

async function loadExtras(p: UserProfile) {
  if (import.meta.env.SSR || !p.oId || String(p.oId).startsWith('mock-')) return
  try {
    viewedVip.value = (await fetchMembership(p.oId)).isVip
  } catch {
    viewedVip.value = isSelf.value && isVip.value
  }
  try {
    profession.value = await fetchPublicProfession(userName.value, apiKey.value)
  } catch {
    profession.value = null
  }
  if (!apiKey.value) {
    extraMedals.value = []
    return
  }
  try {
    extraMedals.value = (await fetchUserMedals(apiKey.value, userName.value)).filter(
      (m) => m.name && !(p.sysMetal || []).some((s) => s.name === m.name),
    )
  } catch {
    extraMedals.value = []
  }
}

async function load() {
  if (!userName.value) return
  const cached =
    profile.value?.userName === userName.value ? profile.value : consumeMemberPayload(userName.value)
  if (!cached) loading.value = true
  error.value = ''
  actionMsg.value = ''
  try {
    const [p, list, moons] = await Promise.all([
      cached || fetchUserProfile(userName.value, apiKey.value),
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
    loading.value = false
    void loadExtras(p)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '用户加载失败'
    if (!cached) profile.value = null
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
    showTransfer.value = false
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '转账失败'
  } finally {
    transferring.value = false
  }
}
</script>

<template>
  <div class="wrapper member-wrap">
    <!-- 主体左侧内容区 (对齐现网 Rhythm home/home.ftl) -->
    <div class="content">
      <p v-if="loading" class="hint">正在加载用户信息…</p>
      <p v-else-if="error" class="err">{{ error }}</p>

      <div v-else-if="profile" class="module">
        <p v-if="usingMock" class="mock-tip">⚠️ 接口未返回，当前展示演示数据</p>
        <!-- 二级导航标签页 -->
        <nav class="tabs-sub">
          <a
            :class="{ current: activeTab === 'articles' }"
            @click="activeTab = 'articles'"
          >
            文章 <span class="count">{{ profile.userArticleCount ?? articles.length }}</span>
          </a>
          <a
            :class="{ current: activeTab === 'moons' }"
            @click="activeTab = 'moons'"
          >
            清风明月 <span class="count">{{ breezemoons.length }}</span>
          </a>
          <a
            :class="{ current: activeTab === 'medals' }"
            @click="activeTab = 'medals'"
          >
            徽章 <span class="count">{{ allMedals.length }}</span>
          </a>
          <a
            v-if="profession?.primaryProfession"
            :class="{ current: activeTab === 'profession' }"
            @click="activeTab = 'profession'"
          >
            职业资料
          </a>
        </nav>

        <!-- 文章列表 -->
        <div v-if="activeTab === 'articles'" class="tab-panel">
          <p v-if="!isLoggedIn && !articles.length" class="hint-auth">
            用户发帖列表需登录查看。
            <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">前往登录</RouterLink>
          </p>
          <p v-else-if="articlesMock" class="hint-auth">当前为社区帖子展示。</p>
          <ArticleFeed :items="articles" empty="该用户还没有公开发布过帖子" />
        </div>

        <!-- 清风明月动态 -->
        <div v-else-if="activeTab === 'moons'" class="tab-panel">
          <ul v-if="breezemoons.length" class="breeze-timeline">
            <li v-for="m in breezemoons" :key="m.oId" class="breeze-timeline-item">
              <div class="breeze-header">
                <span class="avatar-small" :style="{ backgroundImage: `url('${profile.userAvatarURL}')` }" />
                <span class="breeze-author">{{ profile.userNickname || profile.userName }}</span>
                <span class="breeze-time">{{ m.timeAgo }}</span>
              </div>
              <div class="breeze-body" v-html="m.breezemoonContent || ''" />
            </li>
          </ul>
          <p v-else class="empty-panel">暂无清风明月动态</p>
        </div>

        <!-- 徽章与勋章 -->
        <div v-else-if="activeTab === 'medals'" class="tab-panel medals-panel">
          <div v-if="allMedals.length" class="medals-grid">
            <div
              v-for="item in allMedals"
              :key="item.name"
              class="medal-card"
              :style="{ borderColor: item.backcolor || 'var(--fp-border)' }"
            >
              <img v-if="item.url" class="medal-icon" :src="item.url" :alt="item.name" />
              <div class="medal-info">
                <b class="medal-name" :style="{ color: item.fontcolor || 'inherit' }">{{ item.name }}</b>
                <span v-if="item.description" class="medal-desc">{{ item.description }}</span>
              </div>
            </div>
          </div>
          <p v-else class="empty-panel">暂未佩戴徽章</p>
        </div>

        <!-- 职业资料卡片 (对齐现网 Rhythm profession.css) -->
        <div v-else-if="activeTab === 'profession' && profession" class="tab-panel profession-panel">
          <div class="profession-detail__summary">
            <h3 class="profession-detail__title">
              {{ profession.primaryProfession?.displayName || profession.primaryProfession?.shortName }}
              <span v-if="profession.primaryProfession?.levelName" class="prof-level">
                · {{ profession.primaryProfession.levelName }}
              </span>
            </h3>
            <p v-if="profession.primaryProfession?.description">
              {{ profession.primaryProfession.description }}
            </p>
            <div v-if="profession.professions?.length" class="professions-list">
              <div
                v-for="job in profession.professions"
                :key="job.professionId || job.displayName"
                class="job-chip"
              >
                <b>{{ job.displayName || job.shortName }}</b>
                <span v-if="job.levelName">{{ job.levelName }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 主体右侧用户卡片 (对齐现网 Rhythm home/home-side.ftl) -->
    <div class="side">
      <div v-if="profile" class="module profile-module">
        <!-- 封面图背景 -->
        <div
          class="user-background"
          :style="
            profile.cardBg
              ? { backgroundImage: `url('${profile.cardBg}')` }
              : { background: 'linear-gradient(135deg, #74ebd5 0%, #9face6 100%)' }
          "
        />

        <!-- 外突居中圆形大头像 -->
        <div class="avatar-wrap">
          <img
            v-if="profile.userAvatarURL"
            class="user-card-avatar"
            :src="profile.userAvatarURL"
            :alt="profile.userName"
          />
          <div v-else class="user-card-avatar fallback">{{ profile.userName.slice(0, 1) }}</div>
        </div>

        <!-- 名字与徽章区 -->
        <div class="user-name-section">
          <h2 class="user-nickname">{{ profile.userNickname || profile.userName }}</h2>
          <div class="user-handle">@{{ profile.userName }}</div>

          <!-- 勋章小图标 -->
          <div v-if="profile.sysMetal?.length" class="side-metals">
            <MetalBadges :items="profile.sysMetal" />
          </div>

          <!-- 身份徽章与在线标识 -->
          <div class="badges-row">
            <img class="role-badge-img" :src="roleBadgeSrc" alt="身份徽章" />
            <span
              class="status-pill"
              :class="profile.userOnlineFlag ? 'online' : 'offline'"
            >
              {{ profile.userOnlineFlag ? '在线' : '离线' }}
            </span>
            <span v-if="profile.mbti" class="mbti-pill">
              {{ profile.mbti }}
            </span>
            <span v-if="viewedVip" class="vip-pill">VIP</span>
          </div>

          <!-- 交互操作按钮 -->
          <div class="action-buttons">
            <button
              v-if="isLoggedIn && !isSelf && profile.canFollow !== 'hide'"
              type="button"
              class="btn green follow-btn"
              @click="toggleFollow"
            >
              {{ following ? '取消关注' : '+ 关注' }}
            </button>
            <RouterLink
              v-if="isLoggedIn && isSelf"
              class="btn green follow-btn"
              to="/settings"
            >
              编辑资料
            </RouterLink>
            <RouterLink
              v-if="isLoggedIn && !isSelf"
              class="btn small"
              :to="`/chat?toUser=${profile.userName}`"
            >
              发私信
            </RouterLink>
            <button
              v-if="isLoggedIn && !isSelf"
              type="button"
              class="btn small"
              @click="showTransfer = !showTransfer"
            >
              转账
            </button>
            <ReportDialog
              v-if="isLoggedIn && !isSelf"
              :api-key="apiKey"
              :data-id="profile.oId"
              :data-type="2"
            />
          </div>

          <p v-if="actionMsg" class="action-alert" :class="actionMsg.includes('成功') ? 'ok' : 'err'">
            {{ actionMsg }}
          </p>

          <!-- 快捷转账面板 -->
          <form v-if="showTransfer && isLoggedIn && !isSelf" class="transfer-form" @submit.prevent="sendPoints">
            <div class="transfer-inputs">
              <input v-model.number="sendAmount" type="number" min="1" placeholder="积分数" />
              <input v-model="sendMemo" placeholder="备注信息" />
            </div>
            <button type="submit" class="btn green small" :disabled="transferring">
              {{ transferring ? '转账中…' : '确认转账' }}
            </button>
          </form>
        </div>

        <!-- 详细个人资料列表 -->
        <div class="user-details-list">
          <div v-if="profile.userIntro" class="user-intro-text">
            {{ profile.userIntro }}
          </div>
          <div class="detail-row">
            <span class="label">会员：</span>
            <span>摸鱼派第 {{ profile.userNo || '—' }} 号会员 · {{ profile.userAppRole === 1 ? '🎨 画家' : '💻 黑客' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">积分：</span>
            <span class="points-val">
              <b>{{ profile.userPoint ?? 0 }}</b> (0x{{ pointHex }})
            </span>
          </div>
          <div v-if="profile.userCity" class="detail-row">
            <span class="label">位置：</span>
            <RouterLink :to="`/city/${encodeURIComponent(profile.userCity)}`" class="city-link">
              {{ profile.userCity }}
            </RouterLink>
          </div>
          <div v-if="profile.userURL" class="detail-row">
            <span class="label">主页：</span>
            <a :href="profile.userURL" target="_blank" rel="noopener" class="home-url">
              {{ profile.userURL }}
            </a>
          </div>
          <div v-if="profile.onlineMinute" class="detail-row">
            <span class="label">在线时长：</span>
            <span>{{ profile.onlineMinute }} 分钟</span>
          </div>
        </div>

        <!-- 5项统计计数槽 (对齐 Rhythm status fn-flex) -->
        <div class="profile-stats-grid">
          <div class="stat-unit">
            <strong>{{ profile.userArticleCount ?? articles.length }}</strong>
            <span>文章</span>
          </div>
          <div class="stat-unit">
            <strong>{{ profile.userCommentCount ?? 0 }}</strong>
            <span>回帖</span>
          </div>
          <div class="stat-unit">
            <strong>{{ profile.followingUserCount ?? 0 }}</strong>
            <span>关注</span>
          </div>
          <div class="stat-unit">
            <strong>{{ profile.followerCount ?? 0 }}</strong>
            <span>粉丝</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.member-wrap {
  padding-top: 4px;
}

/* 主内容区 */
.tab-panel {
  min-height: 200px;
}

.hint-auth {
  padding: 12px 18px;
  margin: 0;
  font-size: 13px;
  color: var(--fp-muted);
  background: var(--fp-hover);
  border-bottom: 1px solid var(--fp-border);
}

.empty-panel {
  padding: 40px 18px;
  text-align: center;
  color: var(--fp-muted);
  font-size: 14px;
}

/* 清风明月时间线 */
.breeze-timeline {
  list-style: none;
  margin: 0;
  padding: 14px 18px;
}

.breeze-timeline-item {
  padding: 12px 0;
  border-bottom: 1px dashed var(--fp-border);
}

.breeze-timeline-item:last-child {
  border-bottom: none;
}

.breeze-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;
}

.breeze-author {
  font-weight: 500;
  color: var(--fp-title);
}

.breeze-time {
  color: var(--fp-muted);
  font-size: 11px;
}

.breeze-body {
  font-size: 14px;
  line-height: 1.6;
  color: var(--fp-text);
  padding-left: 28px;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.breeze-body :deep(a) {
  word-break: break-all;
  overflow-wrap: anywhere;
}

.breeze-body :deep(p) {
  margin: 0;
  word-break: break-all;
  overflow-wrap: anywhere;
}

/* 徽章网格 */
.medals-panel {
  padding: 16px 18px;
}

.medals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.medal-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--fp-hover);
  border: 1px solid var(--fp-border);
  border-radius: 8px;
}

.medal-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.medal-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.medal-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.medal-desc {
  font-size: 11px;
  color: var(--fp-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 职业资料面板 */
.profession-panel {
  padding: 16px 18px;
}

.profession-detail__summary {
  background: var(--fp-hover);
  border-radius: 10px;
  padding: 16px;
  border: 1px solid var(--fp-border);
}

.profession-detail__title {
  margin: 0 0 8px;
  font-size: 18px;
  color: var(--fp-title);
}

.prof-level {
  font-size: 14px;
  color: var(--fp-primary);
  font-weight: normal;
}

.professions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.job-chip {
  display: flex;
  gap: 6px;
  padding: 4px 10px;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 6px;
  font-size: 12px;
}

/* 右侧用户卡片 */
.profile-module {
  overflow: hidden;
  text-align: center;
}

.user-background {
  height: 90px;
  background-size: cover;
  background-position: center;
}

.avatar-wrap {
  position: relative;
  margin-top: -46px;
  display: flex;
  justify-content: center;
}

.user-card-avatar {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  border: 4px solid var(--fp-card);
  background: var(--fp-card);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  object-fit: cover;
}

.user-card-avatar.fallback {
  display: grid;
  place-items: center;
  background: var(--fp-hover);
  color: var(--fp-title);
  font-size: 32px;
  font-weight: 700;
}

.user-name-section {
  padding: 10px 16px 14px;
}

.user-nickname {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--fp-title);
}

.user-handle {
  color: var(--fp-muted);
  font-size: 13px;
  margin-top: 2px;
}

.side-metals {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.badges-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.role-badge-img {
  height: 24px;
  object-fit: contain;
}

.status-pill {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  color: #fff;
  font-weight: 500;
}

.status-pill.online {
  background-color: var(--fp-primary);
}

.status-pill.offline {
  background-color: #787777;
}

.mbti-pill {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  background-color: #b2b1ff;
  color: #fff;
  font-weight: 500;
}

.vip-pill {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  background-color: var(--fp-accent);
  color: #fff;
  font-weight: 600;
}

.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.follow-btn {
  width: 100%;
}

.action-alert {
  margin: 8px 0 0;
  font-size: 12px;
  text-align: center;
}

.action-alert.ok {
  color: var(--fp-primary);
}

.action-alert.err {
  color: #e07a5f;
}

.transfer-form {
  margin-top: 10px;
  padding: 10px;
  background: var(--fp-hover);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.transfer-inputs {
  display: flex;
  gap: 6px;
}

.transfer-inputs input {
  flex: 1;
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid var(--fp-border);
  border-radius: 4px;
  background: var(--fp-card);
  color: var(--fp-text);
  outline: none;
}

/* 详细档案列表 */
.user-details-list {
  padding: 12px 16px;
  border-top: 1px solid var(--fp-border);
  text-align: left;
  font-size: 12px;
  line-height: 1.8;
}

.user-intro-text {
  color: var(--fp-text);
  margin-bottom: 8px;
  line-height: 1.5;
  word-break: break-all;
}

.detail-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: var(--fp-text);
}

.detail-row .label {
  color: var(--fp-muted);
  flex-shrink: 0;
}

.points-val b {
  color: var(--fp-accent);
}

.city-link,
.home-url {
  color: var(--fp-link);
  text-decoration: none;
}

.city-link:hover,
.home-url:hover {
  text-decoration: underline;
}

/* 5项统计计数槽 */
.profile-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid var(--fp-border);
  text-align: center;
  background: var(--fp-hover);
}

.stat-unit {
  padding: 10px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-right: 1px solid var(--fp-border);
}

.stat-unit:last-child {
  border-right: none;
}

.stat-unit strong {
  font-size: 14px;
  color: var(--fp-title);
}

.stat-unit span {
  font-size: 11px;
  color: var(--fp-muted);
}
</style>
