<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, ref, useId, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { fetchV3ProfessionSummary } from '@/api/v3-profession-public'
import { usePublicMedals } from '@/composables/usePublicMedals'
import { useAuthStore } from '@/stores/auth'
import { rhyPicThumbnail } from '@/utils/avatar'
import { formatDateTime } from '@/utils/time'
import V3MedalImage from '@/components/medal/V3MedalImage.vue'

const props = defineProps<{ userName: string }>()
const auth = useAuthStore(), route = useRoute()
const name = computed(() => props.userName)
const medals = usePublicMedals(name)
const { value, p, loading, error, read } = medals
const previewCount = 1
const showMedals = ref(false)
const medalsMounted = ref(false)
const openMedal = ref<number | null>(null)
const medalHintId = useId()
const summary = ref<Awaited<ReturnType<typeof fetchV3ProfessionSummary>>>(null)
const shownMedals = computed(() => showMedals.value ? value.value?.list : value.value?.list.slice(0, previewCount))
const remaining = computed(() => Math.max(0, (value.value?.total ?? 0) - previewCount))
let mounted = false
let pending: AbortController | undefined

async function loadProfession() {
  pending?.abort()
  summary.value = null
  if (!mounted || !auth.initialized) return
  const controller = new AbortController()
  pending = controller
  try {
    const result = await fetchV3ProfessionSummary(props.userName, controller.signal)
    if (!controller.signal.aborted) summary.value = result
  } catch {
    // 主页只展示可用的职业卡片。
  }
}
function toggleMedals() {
  showMedals.value = !showMedals.value
  openMedal.value = null
  if (!showMedals.value && p.value !== 1) void read(1)
}
function openLinkedSection(hash: string) {
  if (hash === '#member-medals') showMedals.value = true
  else if (hash !== '#member-profession') return
  void nextTick(() => {
    if (mounted && route.hash === hash) globalThis.document?.getElementById(hash.slice(1))?.scrollIntoView({ block: 'nearest' })
  })
}
watch(() => route.hash, openLinkedSection)
watch(value, () => { openMedal.value = null })
watch([() => auth.initialized, () => auth.accessToken, () => auth.account?.oId, name], loadProfession, { flush: 'sync' })
onMounted(() => { mounted = true; medalsMounted.value = true; openLinkedSection(route.hash); void loadProfession() })
onScopeDispose(() => { mounted = false; pending?.abort() })
</script>

<template>
  <div class="profile-badges">
    <section v-if="medalsMounted && auth.isLoggedIn" id="member-medals" aria-label="公开勋章">
      <div v-if="shownMedals?.length" class="medal-row">
        <div v-for="(medal, index) in shownMedals" :key="`${p}:${index}:${medal.id}`" class="medal-entry" :class="{ 'is-open': openMedal === index }" @mouseleave="openMedal=null">
          <div class="medal-preview" role="button" tabindex="0" :aria-expanded="openMedal === index" :aria-label="`${medal.name}，查看勋章说明`" :aria-describedby="`${medalHintId}-${index}`" @click="openMedal = openMedal === index ? null : index" @keydown.enter.prevent="openMedal = openMedal === index ? null : index" @keydown.space.prevent="openMedal = openMedal === index ? null : index">
            <V3MedalImage :id="medal.id" :name="medal.name" :user-name="userName" />
          </div>
          <div :id="`${medalHintId}-${index}`" class="medal-description" role="tooltip">
            <strong>{{ medal.name }}</strong>
            <p v-if="medal.description">{{ medal.description }}</p>
            <small>{{ medal.expiresAt === 0 ? '永久有效' : `有效至 ${formatDateTime(medal.expiresAt)}` }}</small>
          </div>
        </div>
      </div>
      <button v-if="remaining || showMedals && value?.total" type="button" :aria-expanded="showMedals" @click="toggleMedals">{{ showMedals ? '收起勋章' : `+${remaining}` }}</button>
      <small v-if="showMedals && loading" role="status">正在读取公开勋章…</small>
      <div v-if="error" class="badge-error"><small role="alert">{{ error }}</small><button type="button" @click="read()">重试勋章</button></div>
      <small v-if="showMedals && value?.total === 0">暂无公开勋章</small>
      <nav v-if="showMedals && value && value.pageCount > 1" aria-label="勋章分页">
        <button type="button" :disabled="p <= 1" @click="read(p - 1)">上一页</button>
        <small>{{ p }} / {{ value.pageCount }}</small>
        <button type="button" :disabled="p >= value.pageCount" @click="read(p + 1)">下一页</button>
      </nav>
    </section>

    <section id="member-profession" aria-label="职业">
      <RouterLink v-if="summary" to="/top/profession" class="profession-badge" aria-label="查看职业排行榜">
        <img v-if="summary.iconUrl" :src="rhyPicThumbnail(summary.iconUrl, 32)" referrerpolicy="no-referrer" alt="" />
        <span><strong>{{ summary.job.displayName }}</strong><small v-if="summary.job.state !== 'SELECTED'">{{ summary.job.levelName }}</small></span>
        <span class="profession-arrow" aria-hidden="true">›</span>
      </RouterLink>
    </section>
  </div>
</template>

<style scoped lang="scss">
.profile-badges section:not(:empty) { margin-top: 10px; }
.profile-badges button { background: var(--fp-surface-subtle); border: 1px solid var(--fp-border); border-radius: 7px; color: var(--fp-text); font: inherit; font-size: 12px; padding: 3px 7px; cursor: pointer; }
.profile-badges button:disabled { opacity: .55; cursor: default; }
.medal-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 8px; }
.medal-entry { position: relative; max-width: 100%; }
.medal-preview, nav, .badge-error { display: flex; align-items: center; justify-content: center; gap: 5px; }
.medal-preview button { background: transparent; border: 0; color: var(--fp-muted); padding: 3px; }
.medal-preview { cursor: help; border-radius: 6px; }
.medal-preview:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
.medal-description { display: none; position: absolute; z-index: 20; top: 100%; left: 50%; transform: translateX(-50%); box-sizing: border-box; width: min(230px, 65vw); padding: 10px 12px; border: 1px solid var(--fp-border); border-radius: 8px; background: var(--fp-card); color: var(--fp-text); box-shadow: 0 6px 20px rgb(0 0 0 / 12%); font-size: 12px; line-height: 1.6; text-align: left; overflow-wrap: anywhere; }
.medal-entry.is-open .medal-description,
.medal-entry:has(.medal-preview:focus-visible) .medal-description { display: block; }
@media (hover: hover) { .medal-entry:hover .medal-description { display: block; } }
.medal-description p { margin: 4px 0; }
small { color: var(--fp-muted); }
.profile-badges .profession-badge { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 6px 10px; text-align: left; color: var(--fp-text); background: var(--fp-surface-subtle); border: 1px solid var(--fp-border); border-radius: 8px; }
.profile-badges a.profession-badge { text-decoration: none; transition: background 160ms ease, border-color 160ms ease; }
.profile-badges a.profession-badge:hover { text-decoration: none; background: var(--fp-hover); border-color: var(--fp-primary); }
.profile-badges a.profession-badge:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
.profession-arrow { color: var(--fp-muted); }
.profession-badge strong, .profession-badge small { display: block; }
.profession-badge img { width: 32px; height: 32px; object-fit: contain; }
nav { margin-top: 6px; }
</style>
