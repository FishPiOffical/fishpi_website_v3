<script setup lang="ts">
import { RouterLink } from 'vue-router'
import CheckinPanel from '@/components/home/CheckinPanel.vue'
import RecentMembers from '@/components/discovery/RecentMembers.vue'
import RandomArticles from '@/components/discovery/RandomArticles.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()
usePageSeo(() => ({ title: '活动中心', path: '/activity', description: '摸鱼派签到、昨日活跃奖励与发现' }))
</script>
<template><div class="activity-page fp-page fp-ui"><section class="activity-card fp-card"><h1 class="fp-page-title">活动中心</h1><p>签到与昨日活跃奖励；小游戏与鱼游见<RouterLink to="/games">游戏入口</RouterLink>。</p><CheckinPanel v-if="auth.isLoggedIn" /><p v-else><RouterLink :to="{ path: '/login', query: { redirect: '/activity' } }">登录</RouterLink>后可签到与领取奖励。</p></section><section class="activity-card fp-card"><RandomArticles /></section><section class="activity-card fp-card"><RecentMembers /></section></div></template>
<style scoped lang="scss">.activity-page { display: grid; gap: 18px; }.activity-card { padding: 20px; border: 1px solid var(--fp-border); border-radius: var(--fp-panel-radius); background: var(--fp-card); min-width: 0; } h1 { color: var(--fp-title); font-size: 23px; } p { color: var(--fp-muted); line-height: 1.7; } a { color: var(--fp-link); } @media(max-width:600px) { .activity-card { padding: 14px; } }</style>
