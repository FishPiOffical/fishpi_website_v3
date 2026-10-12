<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import VipNickname from '@/components/user/VipNickname.vue'
import { avatarUrl } from '@/utils/avatar'

const { account, isLoggedIn } = storeToRefs(useAuthStore())
</script>

<template>
  <div v-if="isLoggedIn && account" class="person-card">
    <div class="person-head">
      <RouterLink :to="`/member/${account.userName}`" class="person-avatar-link">
        <img class="person-avatar" :src="avatarUrl(account)" :alt="account.userName" />
      </RouterLink>
      <div class="person-meta">
        <RouterLink :to="`/member/${account.userName}`" class="person-name">
          <VipNickname :user-id="account.oId" :user-name="account.userName" :text="account.userNickname || account.userName" />
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
      <RouterLink to="/following" class="stat-col">
        <strong>关注</strong>
        <span>我的关注</span>
      </RouterLink>
      <RouterLink to="/stars" class="stat-col">
        <strong>收藏</strong>
        <span>我的收藏</span>
      </RouterLink>
      <RouterLink to="/post" class="stat-col action">
        <strong class="post-strong">＋发帖</strong>
        <span>发新内容</span>
      </RouterLink>
    </div>
  </div>
  <div v-else class="guest-card">
    <h3 class="guest-title">摸鱼派</h3>
    <p class="guest-slogan">鱼油专属摸鱼社区，畅聊生活与技术</p>
    <div class="guest-actions">
      <RouterLink to="/login" class="guest-button primary">登录</RouterLink>
      <RouterLink to="/register" class="guest-button">注册</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.person-card { padding: 2px 0 0; }
.person-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.person-avatar { display: block; width: 44px; height: 44px; border: 2px solid var(--fp-border); border-radius: 50%; object-fit: cover; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.person-meta { flex: 1; min-width: 0; }
.person-name { display: block; overflow: hidden; color: var(--fp-title); font-size: 15px; text-decoration: none; text-overflow: ellipsis; white-space: nowrap; }
.person-name:hover { text-decoration: underline; text-underline-offset: 3px; }
.person-sub { display: flex; align-items: center; gap: 6px; margin-top: 3px; font-size: 12px; }
.uname { overflow: hidden; color: var(--fp-muted); text-overflow: ellipsis; white-space: nowrap; }
.role-tag { flex: none; padding: 1px 5px; border-radius: 4px; background: var(--fp-hover); color: var(--fp-head); font-size: 11px; }
.person-stats { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 6px; padding-top: 10px; border-top: 1px solid var(--fp-border); text-align: center; }
.stat-col { display: flex; min-width: 0; flex-direction: column; gap: 2px; text-decoration: none; }
.stat-col strong { overflow: hidden; color: var(--fp-title); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.stat-col span { color: var(--fp-muted); font-size: 10px; }
.stat-col:hover { text-decoration: underline; text-underline-offset: 3px; }
.stat-col.action .post-strong { color: var(--fp-accent); }
.guest-card { padding: 5px 0; text-align: center; }
.guest-title { margin: 0 0 6px; color: var(--fp-title); font-size: 15px; font-weight: 600; }
.guest-slogan { margin: 0 0 12px; color: var(--fp-muted); font-size: 11px; line-height: 1.5; }
.guest-actions { display: flex; gap: 8px; }
.guest-button { flex: 1; padding: 6px 8px; border: 1px solid var(--fp-border); border-radius: 5px; color: var(--fp-text); font-size: 11px; text-align: center; text-decoration: none; }
.guest-button.primary { border-color: var(--fp-primary); background: var(--fp-primary); color: #fff; }
.guest-button:hover { filter: brightness(.96); }
</style>
