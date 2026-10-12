<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink } from 'vue-router'
import { fetchBreezemoons, postBreezemoon, type Breezemoon } from '@/api/fishpi'
import FpLoading from '@/components/FpLoading.vue'
import { useAuthStore } from '@/stores/auth'
import { readCache, writeCache } from '@/utils/swr'

const { apiKey, isLoggedIn } = storeToRefs(useAuthStore())
const MOONS_KEY = 'sidebar:moons'
const moons = ref<Breezemoon[]>([])
const moonsLoaded = ref(false)
const moonDraft = ref('')
const moonBusy = ref(false)
const moonMsg = ref('')

async function loadMoons() {
  const hit = readCache<Breezemoon[]>(MOONS_KEY)
  if (hit) {
    moons.value = hit
    moonsLoaded.value = true
  }
  try {
    moons.value = (await fetchBreezemoons(1, 6)).slice(0, 6)
    writeCache(MOONS_KEY, moons.value)
  } catch {
    if (!hit) moons.value = []
  } finally {
    moonsLoaded.value = true
  }
}

onMounted(() => void loadMoons())

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
  } catch (error) {
    moonMsg.value = error instanceof Error ? error.message : '发布失败'
  } finally {
    moonBusy.value = false
  }
}
</script>

<template>
  <div class="breezemoon-feed">
    <div v-if="isLoggedIn" class="moon-input-row">
      <input
        v-model="moonDraft"
        type="text"
        class="moon-input"
        placeholder="与清风明月为伴，写一句话…"
        :disabled="moonBusy"
        @keydown.enter="onPostMoon"
      />
      <button type="button" class="post-button" :disabled="moonBusy || !moonDraft.trim()" @click="onPostMoon">
        {{ moonBusy ? '…' : '发表' }}
      </button>
    </div>
    <p v-if="moonMsg" class="moon-msg" role="status">{{ moonMsg }}</p>

    <ul class="moon-list">
      <li v-for="item in moons" :key="item.oId" class="moon-item">
        <RouterLink :to="`/member/${item.breezemoonAuthorName || ''}`" class="moon-avatar-wrap">
          <span
            class="avatar-small"
            :data-user-card="item.breezemoonAuthorName"
            :style="item.breezemoonAuthorThumbnailURL48 ? { backgroundImage: `url('${item.breezemoonAuthorThumbnailURL48}')` } : undefined"
            :aria-label="item.breezemoonAuthorName || '用户头像'"
          />
        </RouterLink>
        <div class="moon-body">
          <div class="moon-content" v-html="item.breezemoonContent || ''" />
          <div class="moon-time">{{ item.timeAgo }}</div>
        </div>
      </li>
      <li v-if="!moons.length && !moonsLoaded" class="loading"><FpLoading small /></li>
      <li v-else-if="!moons.length" class="empty-moon">暂无动态</li>
    </ul>
  </div>
</template>

<style scoped>
.breezemoon-feed { min-width: 0; }
.moon-input-row { display: flex; gap: 7px; margin-bottom: 10px; }
.moon-input { flex: 1; min-width: 0; padding: 6px 8px; border: 1px solid var(--fp-border); border-radius: 5px; outline: none; background: var(--fp-card); color: var(--fp-text); font-size: 11px; }
.moon-input:focus { border-color: var(--fp-accent); }
.post-button { flex: none; padding: 5px 8px; border: 0; border-radius: 5px; background: #e79b31; color: #fff; font-size: 11px; cursor: pointer; }
.post-button:disabled { opacity: .55; cursor: default; }
.moon-msg { margin: 0 0 7px; color: var(--fp-primary); font-size: 10px; }
.moon-list { margin: 0; padding: 0; list-style: none; }
.moon-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0; border-bottom: 1px dashed var(--fp-border); }
.moon-item:last-child { padding-bottom: 0; border-bottom: 0; }
.moon-avatar-wrap { flex: none; margin-top: 2px; }
.moon-body { flex: 1; min-width: 0; font-size: 11px; }
.moon-content { color: var(--fp-text); line-height: 1.45; overflow-wrap: anywhere; word-break: break-word; }
.moon-content :deep(a) { overflow-wrap: anywhere; word-break: break-word; }
.moon-content :deep(p) { display: inline; margin: 0; overflow-wrap: anywhere; word-break: break-word; }
.moon-time { margin-top: 3px; color: var(--fp-muted); font-size: 10px; }
.loading, .empty-moon { padding: 10px 0; color: var(--fp-muted); font-size: 11px; text-align: center; }
</style>
