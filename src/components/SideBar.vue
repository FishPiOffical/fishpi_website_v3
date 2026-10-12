<script setup lang="ts">
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import CheckinPanel from '@/components/home/CheckinPanel.vue'
import PersonInfoCard from '@/components/sidebar/PersonInfoCard.vue'
import BreezemoonFeed from '@/components/sidebar/BreezemoonFeed.vue'

const router = useRouter()
const { isLoggedIn } = storeToRefs(useAuthStore())

function goDownload() {
  void router.push('/download')
}
</script>

<template>
  <aside class="sidebar-wrapper">
    <!-- 用户个人信息模块 (对齐现网 Rhythm common/person-info.ftl) -->
    <div class="module person-card">
      <PersonInfoCard />
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
        <BreezemoonFeed />
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
  text-decoration: underline;
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

.stat-col:hover {
  text-decoration: underline;
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
  text-decoration: underline;
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
