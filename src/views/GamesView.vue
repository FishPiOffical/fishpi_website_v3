<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { openRhythmPage } from '@/api/pageAuth'
import { submitFishGame } from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'

usePageSeo(() => ({
  title: '游戏 / 鱼游',
  path: '/games',
  description: '摸鱼派官方小游戏与鱼游投稿入口',
}))

const route = useRoute()
const auth = useAuthStore()
const { apiKey, isLoggedIn } = storeToRefs(auth)

const official = [
  { href: '/games/adarkroom/', title: 'A Dark Room', tip: '黑暗房间' },
  { href: '/games/lifeRestart/view/', title: '人生重开', tip: '模拟器' },
  { href: '/games/emojiPair', title: 'Emoji Pair', tip: '表情配对' },
  { href: '/games/evolve/', title: 'Evolve', tip: '进化' },
  { href: '/games/handle/', title: 'Handle', tip: '摸鱼小玩法' },
]

const activities = [
  { href: '/activity/eating-snake', title: '贪吃蛇', tip: '积分开局' },
  { href: '/activity/gobang', title: '五子棋', tip: '对战' },
  { href: '/activity/catch-the-cat', title: '围住小猫', tip: '益智' },
  { href: '/activity/daxigua', title: '合成大西瓜', tip: '休闲' },
  { href: '/activity/character', title: '写字', tip: '认字活动' },
]

const name = ref('')
const description = ref('')
const url = ref('')
const iconUrl = ref('')
const busy = ref(false)
const msg = ref('')
const err = ref('')

function openGame(href: string) {
  return openRhythmPage(href, apiKey.value)
}

async function submit() {
  err.value = ''
  msg.value = ''
  if (!apiKey.value) {
    err.value = '请先登录'
    return
  }
  if (!name.value.trim() || !url.value.trim()) {
    err.value = '请填写名称与游戏地址'
    return
  }
  busy.value = true
  try {
    await submitFishGame(apiKey.value, {
      fishGameName: name.value.trim(),
      fishGameDescription: description.value.trim(),
      fishGameUrl: url.value.trim(),
      fishGameIconUrl: iconUrl.value.trim(),
    })
    msg.value = '已提交审核，通过后将出现在活动页鱼游列表'
    name.value = ''
    description.value = ''
    url.value = ''
    iconUrl.value = ''
  } catch (e) {
    err.value = e instanceof Error ? e.message : '提交失败'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page">
    <section class="card">
      <h1>游戏 / 鱼游</h1>
      <p class="hint">
        官方小游戏在 Rhythm 页面中运行；点击后会换取页面会话并跳转。鱼游为社区投稿，可在下方投稿。
      </p>
    </section>

    <section class="card">
      <h2>官方游戏</h2>
      <ul class="grid">
        <li v-for="g in official" :key="g.href">
          <button type="button" class="game" @click="openGame(g.href)">
            <strong>{{ g.title }}</strong>
            <span>{{ g.tip }}</span>
          </button>
        </li>
      </ul>
    </section>

    <section class="card">
      <h2>活动小游戏</h2>
      <ul class="grid">
        <li v-for="g in activities" :key="g.href">
          <button type="button" class="game" @click="openGame(g.href)">
            <strong>{{ g.title }}</strong>
            <span>{{ g.tip }}</span>
          </button>
        </li>
      </ul>
      <p class="hint">
        签到与昨日活跃见
        <RouterLink to="/activity">活动中心</RouterLink>
        。
      </p>
    </section>

    <section class="card">
      <h2>鱼游投稿</h2>
      <p class="hint">
        审核通过的鱼游暂无公开 JSON，列表、点赞和评论在
        <a href="/activities" @click.prevent="openGame('/activities')">鱼游广场</a>
        （由现网渲染）。
      </p>
      <p v-if="!isLoggedIn" class="hint">
        <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>
        后可投稿。
      </p>
      <form v-else class="form" @submit.prevent="submit">
        <label>名称<input v-model="name" maxlength="64" required /></label>
        <label>简介<textarea v-model="description" rows="3" maxlength="500" /></label>
        <label>游戏 URL<input v-model="url" type="url" placeholder="https://" required /></label>
        <label>图标 URL（可选）<input v-model="iconUrl" type="url" placeholder="https://" /></label>
        <p v-if="err" class="err">{{ err }}</p>
        <p v-if="msg" class="ok">{{ msg }}</p>
        <button type="submit" class="primary" :disabled="busy">{{ busy ? '提交中…' : '提交审核' }}</button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 860px;
  margin: 0 auto;
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
  margin: 0 0 10px;
  color: var(--fp-muted);
  font-size: 13px;
  line-height: 1.5;
}
.hint a {
  color: var(--fp-link);
}
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}
.game {
  width: 100%;
  text-align: left;
  border: 1px solid var(--fp-border);
  background: var(--fp-bg);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  color: var(--fp-text);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.game:hover {
  border-color: var(--fp-primary);
}
.game strong {
  font-size: 14px;
}
.game span {
  font-size: 12px;
  color: var(--fp-muted);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--fp-muted);
}
input,
textarea {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 6px;
  padding: 8px 10px;
}
.primary {
  align-self: flex-start;
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
}
.err {
  color: #e07a5f;
  font-size: 13px;
  margin: 0;
}
.ok {
  color: var(--fp-green, #3d8b6e);
  font-size: 13px;
  margin: 0;
}
</style>
