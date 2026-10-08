<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchBreezemoons, postBreezemoon, type Breezemoon } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import CheckinPanel from '@/components/home/CheckinPanel.vue'

const auth = useAuthStore()
const router = useRouter()
const { account, isLoggedIn, apiKey } = storeToRefs(auth)

const moons = ref<Breezemoon[]>([])
const moonDraft = ref('')
const moonBusy = ref(false)
const moonMsg = ref('')

async function loadMoons() {
  try {
    moons.value = (await fetchBreezemoons(1, 6)).slice(0, 6)
  } catch {
    moons.value = []
  }
}

onMounted(() => {
  void loadMoons()
})

async function onPostMoon() {
  const content = moonDraft.value.trim()
  if (!content || !apiKey.value || moonBusy.value) return
  moonBusy.value = true
  moonMsg.value = ''
  try {
    await postBreezemoon(apiKey.value, content)
    moonDraft.value = ''
    moonMsg.value = '已发布'
    await loadMoons()
  } catch (e) {
    moonMsg.value = e instanceof Error ? e.message : '发布失败'
  } finally {
    moonBusy.value = false
  }
}

function goDownload() {
  void router.push('/download')
}
</script>

<template>
  <aside class="sidebar-wrapper">
    <!-- 用户个人信息模块 (对齐现网 Rhythm common/person-info.ftl) -->
    <div class="module person-card">
      <template v-if="isLoggedIn && account">
        <div class="person-head">
          <RouterLink :to="`/member/${account.userName}`" class="person-avatar-link">
            <img
              v-if="account.userAvatarURL"
              class="person-avatar"
              :src="account.userAvatarURL"
              :alt="account.userName"
            />
            <span v-else class="person-avatar fallback">{{ account.userName.slice(0, 1) }}</span>
          </RouterLink>
          <div class="person-meta">
            <RouterLink :to="`/member/${account.userName}`" class="person-name">
              <b>{{ account.userNickname || account.userName }}</b>
            </RouterLink>
            <div class="person-sub">
              <span class="uname">@{{ account.userName }}</span>
              <span class="role-tag">{{ account.userAppRole === 1 ? '🎨 画家' : '💻 黑客' }}</span>
            </div>
          </div>
        </div>

        <div class="person-stats">
          <RouterLink :to="`/member/${account.userName}`" class="stat-col">
            <strong>{{ account.userPoint ?? 0 }}</strong>
            <span>积分</span>
          </RouterLink>
          <RouterLink :to="`/following`" class="stat-col">
            <strong>关注</strong>
            <span>我的关注</span>
          </RouterLink>
          <RouterLink :to="`/stars`" class="stat-col">
            <strong>收藏</strong>
            <span>我的收藏</span>
          </RouterLink>
          <RouterLink :to="`/post`" class="stat-col action">
            <strong class="post-strong">＋发帖</strong>
            <span>发新内容</span>
          </RouterLink>
        </div>
      </template>

      <template v-else>
        <div class="guest-card">
          <h3 class="guest-title">摸鱼派</h3>
          <p class="guest-slogan">鱼油专属摸鱼社区，畅聊生活与技术</p>
          <div class="guest-actions">
            <RouterLink to="/login" class="btn green flex-btn">登录</RouterLink>
            <RouterLink to="/register" class="btn flex-btn">注册</RouterLink>
          </div>
        </div>
      </template>
    </div>

    <!-- 签到模块 -->
    <CheckinPanel v-if="isLoggedIn" />

    <!-- 客户端下载横幅 -->
    <div class="module app-download">
      <div class="app-left">
        <img src="https://file.fishpi.cn/logo_app.png" width="36" height="36" alt="摸鱼派客户端" />
        <div class="app-text">
          <b>随时随地摸鱼？</b>
          <p>下载摸鱼派客户端，想摸就摸！</p>
        </div>
      </div>
      <button type="button" class="btn green small" @click="goDownload">下载</button>
    </div>

    <!-- 清风明月快速发表与流式列表 -->
    <div class="module breezemoon-card">
      <div class="module-header">
        <h2>清风明月</h2>
        <RouterLink to="/breezemoons" class="more-link">更多</RouterLink>
      </div>
      <div class="module-panel">
        <div v-if="isLoggedIn" class="moon-input-row">
          <input
            v-model="moonDraft"
            type="text"
            class="moon-input"
            placeholder="与清风明月为伴，写一句话…"
            :disabled="moonBusy"
            @keydown.enter="onPostMoon"
          />
          <button
            type="button"
            class="btn orange small"
            :disabled="moonBusy || !moonDraft.trim()"
            @click="onPostMoon"
          >
            发表
          </button>
        </div>
        <p v-if="moonMsg" class="moon-msg">{{ moonMsg }}</p>

        <ul class="moon-list">
          <li v-for="item in moons" :key="item.oId" class="moon-item">
            <RouterLink :to="`/member/${item.breezemoonAuthorName}`" class="moon-avatar-wrap">
              <span
                class="avatar-small"
                :style="
                  item.breezemoonAuthorThumbnailURL48
                    ? { backgroundImage: `url('${item.breezemoonAuthorThumbnailURL48}')` }
                    : undefined
                "
                :aria-label="item.breezemoonAuthorName"
              />
            </RouterLink>
            <div class="moon-body">
              <div class="moon-content fn-ellipsis" v-html="item.breezemoonContent" />
              <div class="moon-time">{{ item.timeAgo }}</div>
            </div>
          </li>
          <li v-if="!moons.length" class="empty-moon">暂无动态</li>
        </ul>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar-wrapper {
  display: flex;
  flex-direction: column;
}

/* 个人信息卡片 */
.person-card {
  padding: 16px;
}

.person-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.person-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  border: 2px solid var(--fp-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.person-avatar.fallback {
  display: grid;
  place-items: center;
  background: var(--fp-hover);
  color: var(--fp-title);
  font-weight: 700;
  font-size: 16px;
}

.person-meta {
  flex: 1;
  min-width: 0;
}

.person-name {
  color: var(--fp-title);
  text-decoration: none;
  font-size: 15px;
  display: block;
}

.person-name:hover {
  color: var(--fp-link);
}

.person-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  font-size: 12px;
}

.uname {
  color: var(--fp-muted);
}

.role-tag {
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--fp-hover);
  color: var(--fp-head);
}

.person-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--fp-border);
  text-align: center;
}

.stat-col {
  text-decoration: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-col strong {
  color: var(--fp-title);
  font-size: 13px;
}

.stat-col span {
  color: var(--fp-muted);
  font-size: 11px;
}

.stat-col:hover strong {
  color: var(--fp-link);
}

.stat-col.action .post-strong {
  color: var(--fp-accent);
}

/* 未登录卡片 */
.guest-card {
  text-align: center;
  padding: 8px 0;
}

.guest-title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 600;
  color: var(--fp-title);
}

.guest-slogan {
  margin: 0 0 14px;
  font-size: 12px;
  color: var(--fp-muted);
  line-height: 1.5;
}

.guest-actions {
  display: flex;
  gap: 10px;
}

.flex-btn {
  flex: 1;
  text-align: center;
}

/* 下载客户端 */
.app-download {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
}

.app-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-text b {
  display: block;
  font-size: 13px;
  color: var(--fp-title);
}

.app-text p {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--fp-muted);
}

/* 清风明月模块 */
.breezemoon-card .module-panel {
  padding: 12px 14px;
}

.more-link {
  font-size: 12px;
  color: var(--fp-muted);
  text-decoration: none;
}

.more-link:hover {
  color: var(--fp-link);
}

.moon-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.moon-input {
  flex: 1;
  border: 1px solid var(--fp-border);
  background: var(--fp-card);
  color: var(--fp-text);
  border-radius: 4px;
  padding: 5px 8px;
  font-size: 12px;
  outline: none;
}

.moon-input:focus {
  border-color: var(--fp-accent);
}

.moon-msg {
  font-size: 11px;
  color: var(--fp-primary);
  margin: 0 0 8px;
}

.moon-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.moon-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px dashed var(--fp-border);
}

.moon-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.moon-avatar-wrap {
  flex-shrink: 0;
  margin-top: 2px;
}

.moon-body {
  flex: 1;
  min-width: 0;
  font-size: 12px;
}

.moon-content {
  color: var(--fp-text);
  line-height: 1.4;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.moon-content :deep(a) {
  word-break: break-all;
  overflow-wrap: anywhere;
}

.moon-content :deep(p) {
  margin: 0;
  display: inline;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.moon-time {
  margin-top: 2px;
  font-size: 11px;
  color: var(--fp-muted);
}

.empty-moon {
  text-align: center;
  color: var(--fp-muted);
  font-size: 12px;
  padding: 12px 0;
}
</style>
