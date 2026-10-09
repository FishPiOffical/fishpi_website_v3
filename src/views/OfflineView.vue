<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { pingApi } from '@/api/http'
import { usePageSeo } from '@/composables/usePageSeo'
import WaitingFishGame from '@/games/waitingFish/WaitingFishGame.vue'

const route = useRoute()
const router = useRouter()
const checking = ref(false)
const lastError = ref('')
const onlineHint = ref(typeof navigator === 'undefined' ? true : navigator.onLine)

usePageSeo(() => ({ title: '无法连接服务器', path: route.fullPath, robots: 'noindex' }))

function backTarget() {
  const from = typeof route.query.from === 'string' ? route.query.from : ''
  if (from && from !== '/offline' && !from.startsWith('/error/')) return from
  return '/'
}

async function retry() {
  checking.value = true
  lastError.value = ''
  onlineHint.value = navigator.onLine
  try {
    const ok = await pingApi()
    if (!ok) {
      lastError.value = '接口仍无响应，请稍后再试'
      return
    }
    await router.replace(backTarget())
  } catch (e) {
    lastError.value = e instanceof Error ? e.message : '仍然连不上后端'
  } finally {
    checking.value = false
  }
}

function onOnline() {
  onlineHint.value = true
}
function onOffline() {
  onlineHint.value = false
}

onMounted(() => {
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
})
onUnmounted(() => {
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
})
</script>

<template>
  <section class="page">
    <p class="mark">offline</p>
    <h1>连不上摸鱼派接口</h1>
    <p class="desc">
      浏览器能打开本站页面，但请求后端时失败了。常见原因是本机网络中断、代理未启动，或后端接口维护中。<br/>等恢复的功夫，先摸几竿鱼吧。
    </p>
    <p v-if="!onlineHint" class="warn">⚠️ 检测到浏览器处于离线状态，请先恢复网络。</p>
    <p v-if="lastError" class="err">❌ {{ lastError }}</p>
    <div class="actions">
      <button type="button" class="primary" :disabled="checking" @click="retry">
        {{ checking ? '检测中…' : '重新连接' }}
      </button>
      <RouterLink to="/" class="ghost">回首页</RouterLink>
      <RouterLink to="/recent" class="ghost">看最新</RouterLink>
    </div>
    <p class="hint">可以稍后再尝试；服务恢复后点「重新连接」会回到刚才的页面。</p>
    <div class="game-wrap">
      <WaitingFishGame />
    </div>
  </section>
</template>

<style scoped>
.page {
  max-width: 640px;
  margin: 40px auto 56px;
  padding: 36px 28px;
  border: 1px solid var(--fp-border);
  border-radius: 14px;
  background: var(--fp-card);
  text-align: center;
}
.mark {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fp-accent);
}
h1 {
  margin: 10px 0 8px;
  font-size: 22px;
  color: var(--fp-title);
}
.desc {
  margin: 0 0 24px;
  font-size: 14px;
  color: var(--fp-muted);
  line-height: 1.6;
}
.hint {
  margin: 16px 0 0;
  font-size: 13px;
  color: var(--fp-muted);
  opacity: 0.8;
}
.warn,
.err {
  display: inline-block;
  margin: 0 auto 16px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
  background: var(--fp-bg);
}
.warn {
  color: var(--fp-accent);
  border: 1px solid color-mix(in srgb, var(--fp-accent) 30%, transparent);
}
.err {
  color: #e07a5f;
  border: 1px solid color-mix(in srgb, #e07a5f 30%, transparent);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-bottom: 24px;
}
.game-wrap {
  margin-top: 24px;
  border-top: 1px dashed var(--fp-border);
  padding-top: 24px;
}
.primary,
.ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 100px;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  border: 0;
  cursor: pointer;
  font: inherit;
  transition: all 0.2s;
}
.primary {
  background: var(--fp-primary);
  color: #fff;
}
.primary:not(:disabled):hover {
  filter: brightness(1.1);
}
.primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.ghost {
  border: 1px solid var(--fp-border);
  color: var(--fp-link);
  background: transparent;
}
.ghost:hover {
  background: var(--fp-hover);
}
</style>
