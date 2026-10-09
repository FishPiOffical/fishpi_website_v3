<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { usePageSeo } from '@/composables/usePageSeo'

usePageSeo(() => ({ title: '请选择发布类型', path: '/pre-post', robots: 'noindex' }))

const OPTIONS = [
  { to: '/post?type=0', icon: '📝', label: '帖子', tip: '分享对别人有帮助的经验与见解' },
  { to: '/post?type=5', icon: '❓', label: '问答', tip: '总有一个人知道这个问题的答案' },
  { to: '/post?type=1&tags=机要', icon: '🔒', label: '机要', tip: '邀请好友在私密空间中进行交流' },
  { to: '/post?type=2', icon: '📢', label: '同城广播', tip: '发起你所在城市的招聘、Meetup 等，仅需 100 积分' },
  { to: '/post/long', icon: '📖', label: '长文章', tip: '适合创作小说、长篇故事等' },
]
</script>

<template>
  <section class="card pre-post">
    <h1>请选择发布类型</h1>
    <div class="grid">
      <RouterLink v-for="o in OPTIONS" :key="o.to" :to="o.to" class="opt">
        <span class="icon">{{ o.icon }}</span>
        <b>{{ o.label }}</b>
        <span class="tip">{{ o.tip }}</span>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.pre-post {
  display: block;
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
  box-sizing: border-box;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
}
.pre-post h1 {
  font-size: 18px;
  margin: 0 0 20px;
  text-align: center;
  color: var(--fp-title);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
}
.opt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 12px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  color: var(--fp-text);
  text-align: center;
  text-decoration: none;
  transition: border-color 0.15s, transform 0.15s;
}
.opt:hover {
  border-color: var(--fp-accent);
  transform: translateY(-2px);
}
.icon {
  font-size: 32px;
}
.tip {
  font-size: 12px;
  color: var(--fp-muted);
  line-height: 1.5;
}
</style>
