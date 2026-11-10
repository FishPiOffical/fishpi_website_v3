<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { fetchV3ProfessionSummary } from '@/api/v3-profession-public'
import { usePublicMedals } from '@/composables/usePublicMedals'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/time'
import V3MedalImage from '@/components/medal/V3MedalImage.vue'

const props = defineProps<{ userName: string }>()
const auth = useAuthStore(), route = useRoute()
const name = computed(() => props.userName)
const medals = usePublicMedals(name)
const { value, p, loading, error, read } = medals
const previewCount = 1
const showMedals = ref(false)
const openMedal = ref<number | null>(null)
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
onMounted(() => { mounted = true; openLinkedSection(route.hash); void loadProfession() })
onScopeDispose(() => { mounted = false; pending?.abort() })
</script>

<template>
  <div class="profile-badges">
    <section id="member-medals" aria-label="公开勋章">
      <div v-if="shownMedals?.length" class="medal-row">
        <div v-for="(medal, index) in shownMedals" :key="`${p}:${index}:${medal.id}`" class="medal-entry">
          <div class="medal-preview">
            <V3MedalImage :id="medal.id" :name="medal.name" :user-name="userName" />
            <button type="button" class="medal-info" :aria-label="`查看${medal.name}的说明`" :aria-expanded="openMedal === index" @click="openMedal = openMedal === index ? null : index">ⓘ</button>
          </div>
          <div v-if="openMedal === index" class="medal-description">
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
        <img v-if="summary.iconUrl" :src="summary.iconUrl" referrerpolicy="no-referrer" alt="" />
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
.medal-entry { max-width: 100%; }
.medal-preview, nav, .badge-error { display: flex; align-items: center; justify-content: center; gap: 5px; }
.medal-preview button { background: transparent; border: 0; color: var(--fp-muted); padding: 3px; }
.medal-description { padding: 6px; font-size: 12px; }
.medal-description p { margin: 4px 0; }
small { color: var(--fp-muted); }
.profile-badges .profession-badge { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 6px 10px; text-align: left; color: var(--fp-text); background: var(--fp-surface-subtle); border: 1px solid var(--fp-border); border-radius: 8px; }
.profession-arrow { color: var(--fp-muted); }
.profession-badge strong, .profession-badge small { display: block; }
.profession-badge img { width: 32px; height: 32px; object-fit: contain; }
nav { margin-top: 6px; }
</style>
