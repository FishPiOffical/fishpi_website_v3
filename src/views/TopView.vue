<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  fetchBalanceRank,
  fetchCheckinRank,
  fetchConsumptionRank,
  fetchOnlineRank,
  fetchProfessionRanking,
  fetchDonateRank,
  fetchPerfectRank,
  fetchInviteRank,
  fetchGameRank,
  type ProfessionRankEntry,
  type RankUser,
  type DonateRankData,
  type CountRankEntry,
  type GameRankEntry,
} from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeRanksPayload } from '@/seo/payload'
import { useAuthStore } from '@/stores/auth'
import SideBar from '@/components/SideBar.vue'

const route = useRoute()
const auth = useAuthStore()
const { apiKey, isLoggedIn } = storeToRefs(auth)

const checkin = ref<RankUser[]>([])
const online = ref<RankUser[]>([])
const balance = ref<RankUser[]>([])
const consumption = ref<RankUser[]>([])
const donateData = ref<DonateRankData>({ totalAmount: 0, donateMakeDays: 0, data: [] })
const perfectList = ref<CountRankEntry[]>([])
const inviteList = ref<CountRankEntry[]>([])
const gameList = ref<GameRankEntry[]>([])
const jobs = ref<{ professionId?: string; displayName?: string; professionName?: string }[]>([])
const jobId = ref('')
const jobEntries = ref<ProfessionRankEntry[]>([])
const jobError = ref('')
const error = ref('')
const loading = ref(false)
const wealthHint = ref('')

const gameTabs = [
  { path: '/top/xiaoice', name: '小冰修仙' },
  { path: '/top/evolve', name: '进化 Evolve' },
  { path: '/top/adr', name: '小黑屋 ADR' },
  { path: '/top/mofish', name: '摸鱼大闯关' },
  { path: '/top/smallmofish', name: '摸鱼小闯关' },
  { path: '/top/lifeRestart', name: '人生重开' },
  { path: '/top/emoji', name: '真假小黄脸' },
]

const currentTab = computed(() => {
  if (route.path === '/top/online') return 'online'
  if (route.path === '/top/balance') return 'balance'
  if (route.path === '/top/consumption') return 'consumption'
  if (route.path === '/top/donate') return 'donate'
  if (route.path === '/top/profession') return 'profession'
  if (route.path === '/top/perfect') return 'perfect'
  if (route.path === '/top/invite') return 'invite'
  if (gameTabs.some((g) => g.path === route.path)) return 'game'
  if (route.path === '/top/checkin') return 'checkin'
  if (route.path === '/top') return 'index'
  return 'checkin'
})

const pageTitle = computed(() => {
  switch (currentTab.value) {
    case 'balance':
      return '积分财富排行'
    case 'consumption':
      return '积分支出排行'
    case 'checkin':
      return '连签排行'
    case 'online':
      return '在线时间排行'
    case 'donate':
      return '鱼排续命师'
    case 'profession':
      return '职业排行'
    case 'perfect':
      return '优选排行'
    case 'invite':
      return '邀请成员排行'
    case 'game':
      return '摸鱼游戏娱乐榜'
    default:
      return '总榜'
  }
})

usePageSeo(() => ({
  title: pageTitle.value,
  path: route.path,
  description: '摸鱼派连签、在线、财富、消费与职业风云榜',
}))

const usingMock = computed(
  () => checkin.value.some((u) => ['csfwff', 'Yui'].includes(u.userName) && checkin.value.length <= 8),
)

function pointOf(u: RankUser) {
  return Number(u.userPoint ?? u.point ?? 0)
}

function usedOf(u: RankUser) {
  return Number(u.userUsedPoint ?? u.point ?? u.userPoint ?? 0)
}

function formatOnline(min?: number) {
  const m = Number(min || 0)
  if (m >= 1440) {
    const days = (m / 1440).toFixed(1)
    return `${days} 天`
  }
  if (m >= 60) {
    const hours = (m / 60).toFixed(1)
    return `${hours} 小时`
  }
  return `${m} 分钟`
}

async function load() {
  error.value = ''
  wealthHint.value = ''
  loading.value = true
  try {
    const cached = consumeRanksPayload()
    if (cached) {
      checkin.value = cached.checkin
      online.value = cached.online
    } else {
      ;[checkin.value, online.value] = await Promise.all([
        fetchCheckinRank(apiKey.value),
        fetchOnlineRank(apiKey.value),
      ])
    }
    ;[balance.value, consumption.value, donateData.value, perfectList.value, inviteList.value] = await Promise.all([
      fetchBalanceRank(apiKey.value),
      fetchConsumptionRank(apiKey.value),
      fetchDonateRank(apiKey.value),
      fetchPerfectRank(apiKey.value),
      fetchInviteRank(apiKey.value),
    ])
    if (!balance.value.length && !consumption.value.length && !apiKey.value) {
      wealthHint.value = '财富榜与消费榜需登录后查看完整排名。'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '排行榜加载失败'
  } finally {
    loading.value = false
  }
  if (!import.meta.env.SSR) {
    await loadJobs()
    if (currentTab.value === 'game') await loadGameRank()
  }
}

async function loadGameRank() {
  const g = route.path.replace('/top/', '')
  if (g) {
    gameList.value = await fetchGameRank(g, apiKey.value)
  }
}

async function loadJobs() {
  jobError.value = ''
  try {
    const data = await fetchProfessionRanking(apiKey.value, jobId.value || undefined)
    jobs.value = data.professions || []
    jobEntries.value = data.entries || []
    const selected = data.selectedProfession?.professionId
    if (!jobId.value && selected) jobId.value = selected
  } catch (e) {
    jobError.value = e instanceof Error ? e.message : '职业榜加载失败'
    jobEntries.value = []
  }
}

watch(apiKey, () => void load(), { immediate: true })
watch(
  () => route.path,
  (p) => {
    if (gameTabs.some((g) => g.path === p)) void loadGameRank()
  },
)

const topCatalog = [
  {
    to: '/top/checkin',
    icon: '♣',
    title: '签到排行',
    desc: '公司打卡是生存，摸鱼才是生活',
    badge: '连签',
    color: '#60b044',
  },
  {
    to: '/top/online',
    icon: '♦',
    title: '在线时间排行',
    desc: '摸鱼总统山，挂机时长大比拼',
    badge: '在线',
    color: '#e59230',
  },
  {
    to: '/top/balance',
    icon: '♠',
    title: '积分财富排行',
    desc: '有钱人的世界我不懂，鱼丸储蓄大亨',
    badge: '财富',
    color: '#f39c12',
  },
  {
    to: '/top/consumption',
    icon: '♥',
    title: '积分支出排行',
    desc: '今晚的消费由公子买单，豪气冲天',
    badge: '消费',
    color: '#e74c3c',
  },
  {
    to: '/top/donate',
    icon: '💰',
    title: '鱼排续命师',
    desc: '摸鱼派续命师资助排行榜，感谢老板们支持！',
    badge: '续命',
    color: '#1abc9c',
  },
  {
    to: '/top/profession',
    icon: '✦',
    title: '职业排行',
    desc: '查看各职业公开进度与等级进阶',
    badge: '职业',
    color: '#3498db',
  },
  {
    to: '/top/perfect',
    icon: '👍',
    title: '优选排行',
    desc: '摸鱼派大佬优质内容产出排名，抱紧大腿！',
    badge: '优选',
    color: '#9b59b6',
  },
  {
    to: '/top/invite',
    icon: '🤝',
    title: '邀请成员排行',
    desc: '感谢你们对摸鱼派社区的杰出贡献',
    badge: '邀请',
    color: '#e67e22',
  },
  {
    to: '/top/xiaoice',
    icon: '🧊',
    title: '小冰游戏排行',
    desc: '看看修仙路上是谁最肝',
    badge: '游戏',
    color: '#00cec9',
  },
  {
    to: '/top/evolve',
    icon: '🧬',
    title: '进化排行榜',
    desc: '进化-Evolve 游戏文明进化排名',
    badge: '游戏',
    color: '#27ae60',
  },
  {
    to: '/top/adr',
    icon: '🕯️',
    title: 'A Dark Room 排行',
    desc: '通过 ADR 游戏的小黑屋玩家总分排名',
    badge: '游戏',
    color: '#34495e',
  },
  {
    to: '/top/mofish',
    icon: '🐟',
    title: '摸鱼大闯关排行',
    desc: '摸鱼大闯关玩家闯关数排名',
    badge: '游戏',
    color: '#2980b9',
  },
  {
    to: '/top/smallmofish',
    icon: '🐠',
    title: '摸鱼小闯关排行',
    desc: '摸鱼小闯关玩家闯关数排名',
    badge: '游戏',
    color: '#16a085',
  },
  {
    to: '/top/lifeRestart',
    icon: '🔄',
    title: '人生重开模拟器排行',
    desc: '人生重开模拟器成就与天赋排名',
    badge: '游戏',
    color: '#d35400',
  },
  {
    to: '/top/emoji',
    icon: '😘',
    title: 'Emoji 真假小黄脸排行',
    desc: 'Emoji 真假小黄脸游戏成绩排名',
    badge: '游戏',
    color: '#f1c40f',
  },
]
</script>

<template>
  <div class="wrapper top-layout">
    <!-- 主体左侧内容区 (对齐现网 Rhythm PC top/macro-top.ftl) -->
    <div class="content">
      <div class="module rank-module">
        <!-- 二级导航标签页 -->
        <nav class="tabs-sub">
          <RouterLink to="/top/checkin" :class="{ current: currentTab === 'checkin' }">
            <span>♣ 连签</span>
          </RouterLink>
          <RouterLink to="/top/online" :class="{ current: currentTab === 'online' }">
            <span>♦ 在线</span>
          </RouterLink>
          <RouterLink to="/top/balance" :class="{ current: currentTab === 'balance' }">
            <span>♠ 财富</span>
          </RouterLink>
          <RouterLink to="/top/consumption" :class="{ current: currentTab === 'consumption' }">
            <span>♥ 消费</span>
          </RouterLink>
          <RouterLink to="/top/donate" :class="{ current: currentTab === 'donate' }">
            <span>💰 续命师</span>
          </RouterLink>
          <RouterLink to="/top/profession" :class="{ current: currentTab === 'profession' }">
            <span>✦ 职业</span>
          </RouterLink>
          <RouterLink to="/top/perfect" :class="{ current: currentTab === 'perfect' }">
            <span>👍 优选</span>
          </RouterLink>
          <RouterLink to="/top/invite" :class="{ current: currentTab === 'invite' }">
            <span>🤝 邀请</span>
          </RouterLink>
          <RouterLink to="/top/xiaoice" :class="{ current: currentTab === 'game' }">
            <span>🎮 游戏</span>
          </RouterLink>
          <RouterLink to="/top" :class="{ current: currentTab === 'index' }">
            <span>🏅 全部</span>
          </RouterLink>
        </nav>

        <!-- 状态提示 -->
        <div v-if="loading" class="hint-bar">正在加载排行榜数据…</div>
        <div v-else-if="error" class="err-bar">{{ error }}</div>
        <div v-else-if="wealthHint" class="warn-bar">
          {{ wealthHint }}
          <RouterLink v-if="!isLoggedIn" :to="{ path: '/login', query: { redirect: route.fullPath } }" class="login-jump">
            去登录
          </RouterLink>
        </div>
        <div v-else-if="usingMock && !apiKey" class="warn-bar">
          匿名排行榜接口未全部开放，部分展示演示对齐数据。
        </div>

        <!-- 1. 连签榜 -->
        <section v-if="currentTab === 'checkin'" class="rank-section">
          <div class="rank-head">
            <div class="rank-head-left">
              <h2><span class="icon-clover">♣</span> 连签排行</h2>
              <p class="rank-slogan">公司打卡是生存，摸鱼才是生活</p>
            </div>
            <span class="rank-count">前 {{ checkin.length }} 名</span>
          </div>

          <div class="rank-list">
            <div
              v-for="(u, i) in checkin"
              :key="'c-' + u.userName"
              class="rank-row"
            >
              <!-- 排名序号 -->
              <div class="rank-num-col">
                <span class="rank-badge" :class="'top-' + (i + 1)">{{ i + 1 }}</span>
              </div>

              <!-- 头像 -->
              <div class="rank-avatar-col">
                <RouterLink :to="`/member/${u.userName}`" class="avatar-link">
                  <span
                    class="avatar-img"
                    :style="
                      u.userAvatarURL48 || u.userAvatarURL
                        ? { backgroundImage: `url('${u.userAvatarURL48 || u.userAvatarURL}')` }
                        : undefined
                    "
                  />
                </RouterLink>
              </div>

              <!-- 用户信息主体 -->
              <div class="rank-info-col">
                <div class="user-line">
                  <RouterLink :to="`/member/${u.userName}`" class="uname">
                    {{ u.userNickname || u.userName }}
                  </RouterLink>
                  <span v-if="u.userNickname && u.userNickname !== u.userName" class="handle">
                    @{{ u.userName }}
                  </span>
                </div>
                <div class="meta-line">
                  <span v-if="u.userNo" class="meta-tag">No.{{ u.userNo }}</span>
                  <span v-if="u.userAppRole != null" class="role-tag">
                    {{ u.userAppRole === 1 ? '🎨 画家' : '💻 黑客' }}
                  </span>
                  <span v-if="u.userIntro" class="intro fn-ellipsis">{{ u.userIntro }}</span>
                </div>
              </div>

              <!-- 右侧对齐数值药丸 -->
              <div class="rank-metric-col">
                <div class="metric-pill">
                  <span class="metric-val streak">{{ u.userCurrentCheckinStreak ?? u.userCheckinStreak ?? 0 }}</span>
                  <span class="metric-unit">天</span>
                  <span v-if="u.userLongestCheckinStreak" class="metric-sub" title="历史最长连签">
                    / {{ u.userLongestCheckinStreak }}
                  </span>
                </div>
              </div>
            </div>

            <p v-if="!checkin.length && !loading" class="empty-tip">暂无连签排行数据</p>
          </div>
        </section>

        <!-- 2. 在线时间榜 -->
        <section v-else-if="currentTab === 'online'" class="rank-section">
          <div class="rank-head">
            <div class="rank-head-left">
              <h2><span class="icon-diamond">♦</span> 在线时间排行</h2>
              <p class="rank-slogan">摸鱼总统山，长青不落幕</p>
            </div>
            <span class="rank-count">前 {{ online.length }} 名</span>
          </div>

          <div class="rank-list">
            <div
              v-for="(u, i) in online"
              :key="'o-' + u.userName"
              class="rank-row"
            >
              <div class="rank-num-col">
                <span class="rank-badge" :class="'top-' + (i + 1)">{{ i + 1 }}</span>
              </div>

              <div class="rank-avatar-col">
                <RouterLink :to="`/member/${u.userName}`" class="avatar-link">
                  <span
                    class="avatar-img"
                    :style="
                      u.userAvatarURL48 || u.userAvatarURL
                        ? { backgroundImage: `url('${u.userAvatarURL48 || u.userAvatarURL}')` }
                        : undefined
                    "
                  />
                </RouterLink>
              </div>

              <div class="rank-info-col">
                <div class="user-line">
                  <RouterLink :to="`/member/${u.userName}`" class="uname">
                    {{ u.userNickname || u.userName }}
                  </RouterLink>
                  <span v-if="u.userNickname && u.userNickname !== u.userName" class="handle">
                    @{{ u.userName }}
                  </span>
                </div>
                <div class="meta-line">
                  <span v-if="u.userNo" class="meta-tag">No.{{ u.userNo }}</span>
                  <span v-if="u.userAppRole != null" class="role-tag">
                    {{ u.userAppRole === 1 ? '🎨 画家' : '💻 黑客' }}
                  </span>
                  <span v-if="u.userIntro" class="intro fn-ellipsis">{{ u.userIntro }}</span>
                </div>
              </div>

              <div class="rank-metric-col">
                <div class="metric-pill">
                  <span class="metric-val online">{{ formatOnline(u.onlineMinute) }}</span>
                </div>
              </div>
            </div>

            <p v-if="!online.length && !loading" class="empty-tip">暂无在线排行数据</p>
          </div>
        </section>

        <!-- 3. 财富榜 -->
        <section v-else-if="currentTab === 'balance'" class="rank-section">
          <div class="rank-head">
            <div class="rank-head-left">
              <h2><span class="icon-spade">♠</span> 积分财富排行</h2>
              <p class="rank-slogan">有钱人的世界我不懂，鱼丸储蓄大亨</p>
            </div>
            <span class="rank-count">前 {{ balance.length }} 名</span>
          </div>

          <div class="rank-list">
            <div
              v-for="(u, i) in balance"
              :key="'b-' + u.userName"
              class="rank-row"
            >
              <div class="rank-num-col">
                <span class="rank-badge" :class="'top-' + (i + 1)">{{ i + 1 }}</span>
              </div>

              <div class="rank-avatar-col">
                <RouterLink :to="`/member/${u.userName}`" class="avatar-link">
                  <span
                    class="avatar-img"
                    :style="
                      u.userAvatarURL48 || u.userAvatarURL
                        ? { backgroundImage: `url('${u.userAvatarURL48 || u.userAvatarURL}')` }
                        : undefined
                    "
                  />
                </RouterLink>
              </div>

              <div class="rank-info-col">
                <div class="user-line">
                  <RouterLink :to="`/member/${u.userName}`" class="uname">
                    {{ u.userNickname || u.userName }}
                  </RouterLink>
                  <span v-if="u.userNickname && u.userNickname !== u.userName" class="handle">
                    @{{ u.userName }}
                  </span>
                </div>
                <div class="meta-line">
                  <span v-if="u.userNo" class="meta-tag">No.{{ u.userNo }}</span>
                  <span v-if="u.userAppRole != null" class="role-tag">
                    {{ u.userAppRole === 1 ? '🎨 画家' : '💻 黑客' }}
                  </span>
                  <span v-if="u.userIntro" class="intro fn-ellipsis">{{ u.userIntro }}</span>
                </div>
              </div>

              <div class="rank-metric-col">
                <div class="metric-pill">
                  <span class="metric-icon">💰</span>
                  <span class="metric-val wealth">{{ pointOf(u).toLocaleString() }}</span>
                </div>
              </div>
            </div>

            <p v-if="!balance.length && !loading" class="empty-tip">暂无财富排行数据</p>
          </div>
        </section>

        <!-- 4. 消费榜 -->
        <section v-else-if="currentTab === 'consumption'" class="rank-section">
          <div class="rank-head">
            <div class="rank-head-left">
              <h2><span class="icon-heart">♥</span> 积分支出排行</h2>
              <p class="rank-slogan">今晚的消费由公子买单，豪气冲天</p>
            </div>
            <span class="rank-count">前 {{ consumption.length }} 名</span>
          </div>

          <div class="rank-list">
            <div
              v-for="(u, i) in consumption"
              :key="'u-' + u.userName"
              class="rank-row"
            >
              <div class="rank-num-col">
                <span class="rank-badge" :class="'top-' + (i + 1)">{{ i + 1 }}</span>
              </div>

              <div class="rank-avatar-col">
                <RouterLink :to="`/member/${u.userName}`" class="avatar-link">
                  <span
                    class="avatar-img"
                    :style="
                      u.userAvatarURL48 || u.userAvatarURL
                        ? { backgroundImage: `url('${u.userAvatarURL48 || u.userAvatarURL}')` }
                        : undefined
                    "
                  />
                </RouterLink>
              </div>

              <div class="rank-info-col">
                <div class="user-line">
                  <RouterLink :to="`/member/${u.userName}`" class="uname">
                    {{ u.userNickname || u.userName }}
                  </RouterLink>
                  <span v-if="u.userNickname && u.userNickname !== u.userName" class="handle">
                    @{{ u.userName }}
                  </span>
                </div>
                <div class="meta-line">
                  <span v-if="u.userNo" class="meta-tag">No.{{ u.userNo }}</span>
                  <span v-if="u.userAppRole != null" class="role-tag">
                    {{ u.userAppRole === 1 ? '🎨 画家' : '💻 黑客' }}
                  </span>
                  <span v-if="u.userIntro" class="intro fn-ellipsis">{{ u.userIntro }}</span>
                </div>
              </div>

              <div class="rank-metric-col">
                <div class="metric-pill">
                  <span class="metric-icon">🛒</span>
                  <span class="metric-val consumption">{{ usedOf(u).toLocaleString() }}</span>
                </div>
              </div>
            </div>

            <p v-if="!consumption.length && !loading" class="empty-tip">暂无消费排行数据</p>
          </div>
        </section>

        <!-- 5. 职业榜 -->
        <section v-else-if="currentTab === 'profession'" class="rank-section">
          <div class="rank-head">
            <div class="rank-head-left">
              <h2><span class="icon-star">✦</span> 职业排行</h2>
              <p class="rank-slogan">按公开职业经验与技能成长排序</p>
            </div>
            <!-- 职业切换选项卡 -->
            <div v-if="jobs.length" class="job-tabs">
              <button
                v-for="job in jobs"
                :key="job.professionId || job.displayName"
                type="button"
                class="job-btn"
                :class="{ on: jobId === job.professionId }"
                @click="jobId = job.professionId || ''; void loadJobs()"
              >
                {{ job.displayName || job.professionName }}
              </button>
            </div>
          </div>

          <p v-if="jobError" class="err-tip">{{ jobError }}</p>

          <div class="rank-list">
            <div
              v-for="(u, i) in jobEntries"
              :key="(u.userName || '') + i"
              class="rank-row"
            >
              <div class="rank-num-col">
                <span class="rank-badge" :class="'top-' + (u.rank || i + 1)">{{ u.rank || i + 1 }}</span>
              </div>

              <div class="rank-avatar-col">
                <RouterLink v-if="u.userName" :to="`/member/${u.userName}`" class="avatar-link">
                  <span
                    class="avatar-img"
                    :style="
                      u.userAvatarURL48 || u.userAvatarURL
                        ? { backgroundImage: `url('${u.userAvatarURL48 || u.userAvatarURL}')` }
                        : undefined
                    "
                  />
                </RouterLink>
                <span v-else class="avatar-img fallback">?</span>
              </div>

              <div class="rank-info-col">
                <div class="user-line">
                  <RouterLink v-if="u.userName" :to="`/member/${u.userName}`" class="uname">
                    {{ u.userNickname || u.userName }}
                  </RouterLink>
                  <span v-else class="uname anonymous">匿名鱼油</span>
                  <span v-if="u.userName && u.userNickname && u.userNickname !== u.userName" class="handle">
                    @{{ u.userName }}
                  </span>
                </div>
                <div class="meta-line">
                  <span class="role-tag profession-tag">
                    {{ u.professionName || u.displayName || '职业进阶' }}
                  </span>
                  <span v-if="u.levelName" class="level-badge">{{ u.levelName }}</span>
                </div>
              </div>

              <div class="rank-metric-col">
                <div class="metric-pill">
                  <span class="metric-val exp">{{ u.totalExperience != null ? Number(u.totalExperience).toLocaleString() : 0 }}</span>
                  <span class="metric-unit">经验</span>
                </div>
              </div>
            </div>

            <p v-if="!jobError && !jobEntries.length && !loading" class="empty-tip">暂无职业排行记录</p>
          </div>
        </section>

        <!-- 6. 鱼排续命师 (对齐现网 Rhythm top/donate.ftl) -->
        <section v-else-if="currentTab === 'donate'" class="rank-section">
          <div class="rank-head">
            <div class="rank-head-left">
              <h2><span class="icon-money">💰</span> 鱼排续命师</h2>
              <p class="rank-slogan">
                感谢你们为社区运营续航 <b>{{ donateData.donateMakeDays }} 天</b>（累计赞助 {{ donateData.totalAmount }} ❤️）
              </p>
            </div>
            <span class="rank-count">前 {{ donateData.data.length }} 名</span>
          </div>

          <div class="rank-list">
            <div
              v-for="(item, i) in donateData.data"
              :key="(item.profile?.userName || '') + i"
              class="rank-row"
            >
              <div class="rank-num-col">
                <span class="rank-badge" :class="'top-' + (i + 1)">{{ i + 1 }}</span>
              </div>

              <div class="rank-avatar-col">
                <RouterLink v-if="item.profile?.userName" :to="`/member/${item.profile.userName}`" class="avatar-link">
                  <span
                    class="avatar-img"
                    :style="
                      item.profile.userAvatarURL48 || item.profile.userAvatarURL
                        ? { backgroundImage: `url('${item.profile.userAvatarURL48 || item.profile.userAvatarURL}')` }
                        : undefined
                    "
                  />
                </RouterLink>
                <span v-else class="avatar-img fallback">?</span>
              </div>

              <div class="rank-info-col">
                <div class="user-line">
                  <RouterLink v-if="item.profile?.userName" :to="`/member/${item.profile.userName}`" class="uname">
                    {{ item.profile.userNickname || item.profile.userName }}
                  </RouterLink>
                  <span v-else class="uname anonymous">匿名老板</span>
                  <span v-if="item.profile?.userName && item.profile?.userNickname && item.profile.userNickname !== item.profile.userName" class="handle">
                    @{{ item.profile.userName }}
                  </span>
                </div>
                <div class="meta-line">
                  <span v-if="item.profile?.userNo" class="meta-tag">No.{{ item.profile.userNo }}</span>
                  <span v-if="item.profile?.userAppRole != null" class="role-tag">
                    {{ item.profile.userAppRole === 1 ? '🎨 画家' : '💻 黑客' }}
                  </span>
                  <span v-if="item.profile?.userIntro" class="intro fn-ellipsis">{{ item.profile.userIntro }}</span>
                </div>
              </div>

              <div class="rank-metric-col">
                <div class="metric-pill donate-pill" :title="`共计赞助 ${item.totalCount} 笔`">
                  <span class="metric-val donate">{{ item.total }}</span>
                  <span class="metric-unit">❤️</span>
                  <span v-if="item.totalCount" class="metric-sub">/ {{ item.totalCount }}笔</span>
                </div>
              </div>
            </div>

            <p v-if="!donateData.data.length && !loading" class="empty-tip">暂无赞助记录</p>
          </div>
        </section>

        <!-- 7. 优选排行 (对齐现网 Rhythm top/perfect.ftl) -->
        <section v-else-if="currentTab === 'perfect'" class="rank-section">
          <div class="rank-head">
            <div class="rank-head-left">
              <h2><span class="icon-thumb">👍</span> 优选排行</h2>
              <p class="rank-slogan">摸鱼派大佬优质内容产出排名，抱紧大腿！</p>
            </div>
            <span class="rank-count">前 {{ perfectList.length }} 名</span>
          </div>

          <div class="rank-list">
            <div
              v-for="(item, i) in perfectList"
              :key="(item.profile?.userName || '') + i"
              class="rank-row"
            >
              <div class="rank-num-col">
                <span class="rank-badge" :class="'top-' + (i + 1)">{{ i + 1 }}</span>
              </div>

              <div class="rank-avatar-col">
                <RouterLink v-if="item.profile?.userName" :to="`/member/${item.profile.userName}`" class="avatar-link">
                  <span
                    class="avatar-img"
                    :style="
                      item.profile.userAvatarURL48 || item.profile.userAvatarURL
                        ? { backgroundImage: `url('${item.profile.userAvatarURL48 || item.profile.userAvatarURL}')` }
                        : undefined
                    "
                  />
                </RouterLink>
                <span v-else class="avatar-img fallback">?</span>
              </div>

              <div class="rank-info-col">
                <div class="user-line">
                  <RouterLink v-if="item.profile?.userName" :to="`/member/${item.profile.userName}`" class="uname">
                    {{ item.profile.userNickname || item.profile.userName }}
                  </RouterLink>
                  <span v-else class="uname anonymous">作者</span>
                  <span v-if="item.profile?.userName && item.profile?.userNickname && item.profile.userNickname !== item.profile.userName" class="handle">
                    @{{ item.profile.userName }}
                  </span>
                </div>
                <div class="meta-line">
                  <span v-if="item.profile?.userNo" class="meta-tag">No.{{ item.profile.userNo }}</span>
                  <span v-if="item.profile?.userIntro" class="intro fn-ellipsis">{{ item.profile.userIntro }}</span>
                </div>
              </div>

              <div class="rank-metric-col">
                <div class="metric-pill">
                  <span class="metric-val perfect">{{ item.count || 0 }}</span>
                  <span class="metric-unit">篇优选</span>
                </div>
              </div>
            </div>

            <p v-if="!perfectList.length && !loading" class="empty-tip">暂无优选记录</p>
          </div>
        </section>

        <!-- 8. 邀请成员排行 (对齐现网 Rhythm top/invite.ftl) -->
        <section v-else-if="currentTab === 'invite'" class="rank-section">
          <div class="rank-head">
            <div class="rank-head-left">
              <h2><span class="icon-hand">🤝</span> 邀请成员排行</h2>
              <p class="rank-slogan">感谢你们对摸鱼派社区的杰出贡献</p>
            </div>
            <span class="rank-count">前 {{ inviteList.length }} 名</span>
          </div>

          <div class="rank-list">
            <div
              v-for="(item, i) in inviteList"
              :key="(item.profile?.userName || '') + i"
              class="rank-row"
            >
              <div class="rank-num-col">
                <span class="rank-badge" :class="'top-' + (i + 1)">{{ i + 1 }}</span>
              </div>

              <div class="rank-avatar-col">
                <RouterLink v-if="item.profile?.userName" :to="`/member/${item.profile.userName}`" class="avatar-link">
                  <span
                    class="avatar-img"
                    :style="
                      item.profile.userAvatarURL48 || item.profile.userAvatarURL
                        ? { backgroundImage: `url('${item.profile.userAvatarURL48 || item.profile.userAvatarURL}')` }
                        : undefined
                    "
                  />
                </RouterLink>
                <span v-else class="avatar-img fallback">?</span>
              </div>

              <div class="rank-info-col">
                <div class="user-line">
                  <RouterLink v-if="item.profile?.userName" :to="`/member/${item.profile.userName}`" class="uname">
                    {{ item.profile.userNickname || item.profile.userName }}
                  </RouterLink>
                  <span v-else class="uname anonymous">邀请者</span>
                  <span v-if="item.profile?.userName && item.profile?.userNickname && item.profile.userNickname !== item.profile.userName" class="handle">
                    @{{ item.profile.userName }}
                  </span>
                </div>
                <div class="meta-line">
                  <span v-if="item.profile?.userNo" class="meta-tag">No.{{ item.profile.userNo }}</span>
                  <span v-if="item.profile?.userIntro" class="intro fn-ellipsis">{{ item.profile.userIntro }}</span>
                </div>
              </div>

              <div class="rank-metric-col">
                <div class="metric-pill">
                  <span class="metric-val invite">{{ item.count || item.c || 0 }}</span>
                  <span class="metric-unit">位成员</span>
                </div>
              </div>
            </div>

            <p v-if="!inviteList.length && !loading" class="empty-tip">暂无邀请记录</p>
          </div>
        </section>

        <!-- 9. 游戏娱乐排行 -->
        <section v-else-if="currentTab === 'game'" class="rank-section">
          <div class="rank-head">
            <div class="rank-head-left">
              <h2><span class="icon-game">🎮</span> 摸鱼游戏娱乐榜</h2>
              <p class="rank-slogan">社区小游戏高手风云榜</p>
            </div>
            <div class="job-tabs">
              <RouterLink
                v-for="g in gameTabs"
                :key="g.path"
                :to="g.path"
                class="job-btn"
                :class="{ on: route.path === g.path }"
              >
                {{ g.name }}
              </RouterLink>
            </div>
          </div>

          <div class="rank-list">
            <div
              v-for="(item, i) in gameList"
              :key="(item.userName || item.uname || '') + i"
              class="rank-row"
            >
              <div class="rank-num-col">
                <span class="rank-badge" :class="'top-' + (item.rank || i + 1)">{{ item.rank || i + 1 }}</span>
              </div>

              <div class="rank-avatar-col">
                <RouterLink v-if="item.userName || item.uname" :to="`/member/${item.userName || item.uname}`" class="avatar-link">
                  <span
                    class="avatar-img"
                    :style="
                      item.userAvatarURL
                        ? { backgroundImage: `url('${item.userAvatarURL}')` }
                        : undefined
                    "
                  />
                </RouterLink>
                <span v-else class="avatar-img fallback">?</span>
              </div>

              <div class="rank-info-col">
                <div class="user-line">
                  <RouterLink v-if="item.userName || item.uname" :to="`/member/${item.userName || item.uname}`" class="uname">
                    {{ item.userNickname || item.userName || item.uname }}
                  </RouterLink>
                  <span v-else class="uname anonymous">玩家</span>
                </div>
                <div class="meta-line">
                  <span v-if="item.ancestry" class="meta-tag">{{ item.ancestry }}</span>
                  <span v-if="item.gongfa" class="role-tag">{{ item.gongfa }}</span>
                  <span v-if="item.userIntro" class="intro fn-ellipsis">{{ item.userIntro }}</span>
                </div>
              </div>

              <div class="rank-metric-col">
                <div class="metric-pill">
                  <span class="metric-val game">{{ item.score != null ? item.score : 0 }}</span>
                  <span class="metric-unit">分/关</span>
                </div>
              </div>
            </div>

            <p v-if="!gameList.length && !loading" class="empty-tip">暂无该游戏排行记录</p>
          </div>
        </section>

        <!-- 6. 榜单总览索引 (对齐现网 Rhythm top/index.ftl) -->
        <section v-else class="rank-section index-section">
          <div class="rank-head">
            <div class="rank-head-left">
              <h2><span class="icon-trophy">🏅</span> 榜单总览</h2>
              <p class="rank-slogan">摸鱼派全站各项成就、活跃与趣味风云榜</p>
            </div>
          </div>

          <div class="catalog-grid">
            <RouterLink
              v-for="item in topCatalog"
              :key="item.to"
              :to="item.to"
              class="catalog-card"
            >
              <div class="card-icon-col" :style="{ color: item.color }">
                <span class="catalog-icon">{{ item.icon }}</span>
              </div>
              <div class="card-body-col">
                <div class="card-title-row">
                  <h3 class="catalog-title">{{ item.title }}</h3>
                  <span class="catalog-tag" :style="{ borderColor: item.color, color: item.color }">
                    {{ item.badge }}
                  </span>
                </div>
                <p class="catalog-desc">{{ item.desc }}</p>
              </div>
            </RouterLink>
          </div>
        </section>
      </div>
    </div>

    <!-- 主体右侧挂件边栏 (对齐整站双列布局) -->
    <div class="side">
      <SideBar />
    </div>
  </div>
</template>

<style scoped>
/* 全局栅格 */
.top-layout {
  display: flex;
  width: 90%;
  max-width: 1300px;
  min-width: 720px;
  margin: 0 auto;
  padding: 22px 0 24px;
}

.content {
  flex: 1;
  min-width: 0;
  margin-right: 20px;
}

.side {
  width: 28%;
  min-width: 260px;
  max-width: 330px;
  flex-shrink: 0;
}

@media (max-width: 960px) {
  .top-layout {
    width: 95%;
    min-width: 0;
    flex-direction: column;
  }
  .content {
    margin-right: 0;
    margin-bottom: 20px;
  }
  .side {
    width: 100%;
    max-width: 100%;
  }
}

/* 主卡片模块 */
.rank-module {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  box-shadow: var(--fp-card-shadow);
  overflow: hidden;
}

/* 二级导航条对齐 Rhythm 规范 */
.tabs-sub {
  display: flex;
  flex-wrap: wrap;
  line-height: 40px;
  border-bottom: 1px solid var(--fp-border);
  background: var(--fp-card);
  padding: 0 16px;
  gap: 8px;
}

.tabs-sub a {
  padding: 0 14px;
  color: var(--fp-muted);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.tabs-sub a:hover {
  color: var(--fp-accent);
}

.tabs-sub a.current {
  color: var(--fp-accent);
  font-weight: 600;
  border-bottom-color: var(--fp-accent);
}

/* 提示栏 */
.hint-bar,
.err-bar,
.warn-bar {
  padding: 10px 18px;
  font-size: 13px;
  border-bottom: 1px solid var(--fp-border);
}
.hint-bar {
  background: var(--fp-bg);
  color: var(--fp-muted);
}
.err-bar {
  background: rgba(207, 34, 46, 0.08);
  color: #cf222e;
}
.warn-bar {
  background: rgba(229, 146, 48, 0.08);
  color: var(--fp-head);
}
.login-jump {
  color: var(--fp-accent);
  margin-left: 6px;
  text-decoration: underline;
}

/* 榜单内容区 */
.rank-section {
  padding: 16px 20px 24px;
}

.rank-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--fp-border);
  margin-bottom: 8px;
  gap: 12px;
}

.rank-head-left h2 {
  margin: 0 0 4px;
  font-size: 17px;
  font-weight: 600;
  color: var(--fp-title);
  display: flex;
  align-items: center;
  gap: 8px;
}

.rank-slogan {
  margin: 0;
  font-size: 12.5px;
  color: var(--fp-muted);
}

.rank-count {
  font-size: 12px;
  color: var(--fp-muted);
  background: var(--fp-bg);
  padding: 2px 10px;
  border-radius: 12px;
  border: 1px solid var(--fp-border);
}

/* 职业筛选标签 */
.job-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.job-btn {
  border: 1px solid var(--fp-border);
  background: var(--fp-bg);
  color: var(--fp-text);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.job-btn:hover {
  border-color: var(--fp-accent);
  color: var(--fp-accent);
}
.job-btn.on {
  background: var(--fp-accent);
  border-color: var(--fp-accent);
  color: #fff;
}

/* 榜单列表容器 */
.rank-list {
  display: flex;
  flex-direction: column;
}

/* 核心对齐行：序号、头像、信息、数值横向整齐对齐 */
.rank-row {
  display: flex;
  align-items: center;
  padding: 12px 6px;
  border-bottom: 1px solid var(--fp-border);
  transition: background-color 0.12s ease;
  gap: 14px;
}

.rank-row:last-child {
  border-bottom: none;
}

.rank-row:hover {
  background-color: var(--fp-hover);
}

/* 1. 序号列 */
.rank-num-col {
  width: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
}

.rank-badge {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  color: var(--fp-muted);
  background: var(--fp-bg);
}

.rank-badge.top-1 {
  background: #f1c40f;
  color: #fff;
  box-shadow: 0 2px 6px rgba(241, 196, 15, 0.4);
}

.rank-badge.top-2 {
  background: #bdc3c7;
  color: #2c3e50;
  box-shadow: 0 2px 6px rgba(189, 195, 199, 0.4);
}

.rank-badge.top-3 {
  background: #e67e22;
  color: #fff;
  box-shadow: 0 2px 6px rgba(230, 126, 34, 0.4);
}

/* 2. 头像列 */
.rank-avatar-col {
  flex-shrink: 0;
}

.avatar-link {
  display: block;
}

.avatar-img {
  display: block;
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background-size: cover;
  background-position: center;
  background-color: var(--fp-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.avatar-img.fallback {
  display: grid;
  place-items: center;
  color: var(--fp-muted);
  font-size: 14px;
}

/* 3. 用户信息主体 */
.rank-info-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-line {
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1.3;
}

.uname {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--fp-title);
  text-decoration: none;
}

.uname:hover {
  color: var(--fp-accent);
}

.uname.anonymous {
  color: var(--fp-muted);
}

.handle {
  font-size: 12px;
  color: var(--fp-muted);
}

.meta-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--fp-muted);
}

.meta-tag,
.role-tag,
.level-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
}

.profession-tag {
  color: #3498db;
  border-color: rgba(52, 152, 219, 0.3);
}

.level-badge {
  color: var(--fp-accent);
  border-color: rgba(229, 146, 48, 0.3);
}

.intro {
  max-width: 320px;
}

/* 4. 右侧指标数据槽 */
.rank-metric-col {
  flex-shrink: 0;
  min-width: 130px;
  display: flex;
  justify-content: flex-end;
}

.metric-pill {
  display: inline-flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 3px;
  padding: 5px 12px;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  border-radius: 14px;
  font-size: 13px;
}

.metric-icon {
  font-size: 12px;
  margin-right: 2px;
}

.metric-val {
  font-weight: 700;
  font-size: 14px;
  color: var(--fp-title);
}

.metric-val.streak {
  color: #cf222e;
}

.metric-val.online {
  color: var(--fp-accent);
}

.metric-val.wealth {
  color: #d35400;
}

.metric-val.consumption {
  color: #8e44ad;
}

.metric-val.exp {
  color: #2980b9;
}

.metric-val.donate {
  color: #e74c3c;
}

.metric-val.perfect {
  color: #9b59b6;
}

.metric-val.invite {
  color: #e67e22;
}

.metric-val.game {
  color: #00cec9;
}

.metric-unit {
  font-size: 12px;
  color: var(--fp-muted);
}

.metric-sub {
  font-size: 11px;
  color: var(--fp-muted);
  margin-left: 2px;
}

.empty-tip {
  padding: 36px 0;
  text-align: center;
  color: var(--fp-muted);
  font-size: 14px;
}

.err-tip {
  color: #cf222e;
  font-size: 13px;
  margin: 8px 0;
}

/* 榜单总览卡片网格 */
.catalog-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-top: 6px;
}

@media (max-width: 720px) {
  .catalog-grid {
    grid-template-columns: 1fr;
  }
}

.catalog-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.15s ease;
}

.catalog-card:hover {
  transform: translateY(-2px);
  border-color: var(--fp-accent);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.card-icon-col {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.card-body-col {
  flex: 1;
  min-width: 0;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  gap: 8px;
}

.catalog-title {
  margin: 0;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--fp-title);
}

.catalog-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid;
}

.catalog-desc {
  margin: 0;
  font-size: 12px;
  color: var(--fp-muted);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 榜单头部小图标 */
.icon-clover {
  color: #60b044;
}
.icon-diamond {
  color: #e59230;
}
.icon-spade {
  color: #34495e;
}
.icon-heart {
  color: #e74c3c;
}
.icon-star {
  color: #3498db;
}
.icon-trophy {
  color: #f1c40f;
}
</style>
