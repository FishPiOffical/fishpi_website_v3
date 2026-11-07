<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { emojiToMarkdown, type EmojiItem, type EmojiGroup } from '@/api/fishpi'
import { getAuthContextVersion } from '@/api/http'
import { fetchV3FrequentEmotions, fetchV3EmojiGroups, fetchV3GroupEmojis } from '@/api/v3-emojis'
import { useAuthStore } from '@/stores/auth'
import FpLoading from '@/components/FpLoading.vue'

const props = withDefaults(defineProps<{ showTrigger?: boolean; placement?: 'above' | 'below'; labels?: Record<string, string> }>(), { showTrigger: true, placement: 'above', labels: () => ({}) })
const emit = defineEmits<{ insert: [markdown: string]; 'open-change': [open: boolean] }>()
const { accessToken, account } = storeToRefs(useAuthStore())
const identity = () => JSON.stringify([getAuthContextVersion(), !!accessToken.value, account.value?.oId || ''])
const open = ref(false), loading = ref(false), error = ref('')
const root = ref<HTMLElement | null>(null), selection = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const position = ref<{ left: string; top: string; width: string; height: string }>()
let anchor: HTMLElement | null = null
let preferred: 'above' | 'below' = props.placement

function place() {
  if (!open.value || !anchor?.getBoundingClientRect || typeof window === 'undefined') return
  const rect = anchor.getBoundingClientRect()
  const margin = 8, gap = 6
  const navBottom = document.querySelector('header.nav')?.getBoundingClientRect().bottom ?? 0
  const topEdge = Math.max(margin, navBottom + margin)
  const bottomEdge = window.innerHeight - margin
  const width = Math.min(264, window.innerWidth - margin * 2)
  const above = Math.max(0, rect.top - gap - topEdge)
  const below = Math.max(0, bottomEdge - rect.bottom - gap)
  const desiredHeight = Math.min(180, window.innerHeight * .55)
  const preferAbove = preferred === 'above'
  const preferredSpace = preferAbove ? above : below
  const useAbove = preferredSpace >= desiredHeight ? preferAbove : above > below
  const height = Math.min(desiredHeight, useAbove ? above : below)
  const top = useAbove ? rect.top - gap - height : rect.bottom + gap
  position.value = {
    left: Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin)) + 'px',
    top: Math.max(topEdge, Math.min(top, bottomEdge - height)) + 'px',
    width: width + 'px',
    height: height + 'px',
  }
}

const CDN_EMOJIS = 'https://file.fishpi.cn/vditor/latest/dist/images/emoji/'
function previewImage(item: EmojiItem) {
  const asset = props.labels[item.name]?.match(/^\$\{emojiSite\}\/([a-z0-9_-]+\.(?:png|gif|webp))$/i)?.[1]
  return item.url || (asset ? CDN_EMOJIS + asset : item.name === 'trollface' ? CDN_EMOJIS + 'trollface.png' : '')
}
const items = ref<EmojiItem[]>([]), groups = ref<EmojiGroup[]>([]), groupId = ref('')
const groupPage = ref(0), groupPages = ref(0), itemPage = ref(0), itemPages = ref(0)
const orderedGroups = computed(() => [...groups.value].sort((a, b) => Number(b.type === 1) - Number(a.type === 1)))
const selectedName = computed(() => groupId.value ? groups.value.find(group => group.oId === groupId.value)?.name || '分组' : '常用表情')
const catalogLoading = ref(false), catalogError = ref('')
let version = 0, catalogVersion = 0
let retryItems: (() => Promise<void>) | undefined
async function load<T>(fetcher: () => Promise<T>, apply: (value: T) => void) {
  const reader = identity(), request = ++version
  if (!accessToken.value) { error.value = '请先登录后使用表情'; return }
  retryItems = () => load(fetcher, apply)
  loading.value = true; error.value = ''
  try { const value = await fetcher(); if (request === version && reader === identity()) apply(value) }
  catch (failure) { if (request === version && reader === identity()) { error.value = failure instanceof Error ? failure.message : '表情加载失败' } }
  finally { if (request === version) loading.value = false }
}
function loadFrequent() {
  if (selection.value) selection.value.scrollTop = 0
  groupId.value = ''; items.value = []; itemPage.value = itemPages.value = 0
  return load(fetchV3FrequentEmotions, frequent => { items.value = frequent })
}
async function loadCatalog(p = 1) {
  if (!accessToken.value || catalogLoading.value) return
  const reader = identity(), request = ++catalogVersion
  catalogLoading.value = true; catalogError.value = ''
  try {
    const page = await fetchV3EmojiGroups(p)
    if (request !== catalogVersion || reader !== identity()) return
    groups.value = p === 1 ? page.list : [...new Map([...groups.value, ...page.list].map(group => [group.oId, group])).values()]
    groupPage.value = page.p; groupPages.value = page.pageCount
  } catch (failure) {
    if (request === catalogVersion && reader === identity()) {
      catalogError.value = failure instanceof Error ? failure.message : '分组加载失败'
    }
  } finally {
    if (request === catalogVersion) catalogLoading.value = false
  }
}

function loadGroup(id: string) {
  if (selection.value) selection.value.scrollTop = 0
  groupId.value = id; items.value = []; itemPage.value = itemPages.value = 0
  return load(() => fetchV3GroupEmojis(id), page => { items.value = page.list; itemPage.value = page.p; itemPages.value = page.pageCount })
}
function moreItems() {
  const id = groupId.value, p = itemPage.value + 1
  return load(() => fetchV3GroupEmojis(id, p), page => { items.value = [...items.value, ...page.list]; itemPage.value = page.p; itemPages.value = page.pageCount })
}
function toggle(trigger?: HTMLElement, placement = props.placement) {
  const target = trigger ?? root.value
  if (open.value && anchor === target) { close(); return }
  anchor = target
  preferred = placement
  if (open.value) { place(); return }
  open.value = true
  emit('open-change', true)
  place()
  groupPage.value = groupPages.value = 0
  groups.value = []
  catalogError.value = ''
  void loadFrequent()
  void loadCatalog()
}
function close() {
  retryItems = undefined
  if (open.value) emit('open-change', false)
  open.value = false
  anchor = null
  position.value = undefined
  version++; catalogVersion++
  loading.value = catalogLoading.value = false
}
function outside(event: Event) {
  if (!open.value || !(event.target instanceof Element)) return
  const target = event.target
  if (panel.value?.contains(target) || anchor?.contains(target) || root.value?.contains(target)) return
  const composer = root.value?.closest('.composer')
  if (composer && target.closest('.composer') === composer && target.closest('[data-emoji-trigger], [data-type="v3-emoji"]')) return
  close()
}
function escape(event: KeyboardEvent) { if (event.key === 'Escape') close() }
onMounted(() => {
  if (typeof document === 'undefined') return
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', escape)
  window.addEventListener?.('scroll', place, true)
  window.addEventListener?.('resize', place)
})
watch(identity, () => { close(); error.value = catalogError.value = ''; items.value = []; groups.value = []; groupId.value = '' }, { flush: 'sync' })
onBeforeUnmount(() => {
  close()
  if (typeof document === 'undefined') return
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', escape)
  window.removeEventListener?.('scroll', place, true)
  window.removeEventListener?.('resize', place)
})
function pick(item: EmojiItem) {
  if (!open.value || loading.value || !accessToken.value || item.oId && !item.url) return
  emit('insert', emojiToMarkdown(item)); close()
}
defineExpose({ toggle })
</script>

<template>
  <div ref="root" class="emoji">
    <button v-if="props.showTrigger" type="button" class="ghost" :aria-expanded="open" aria-label="表情" @click="toggle($event?.currentTarget as HTMLElement)"><svg class="trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 14c1 4 7 4 8 0M8 9h.01M16 9h.01" stroke-linecap="round" /></svg><span>表情</span></button>
    <Teleport :to="position ? 'body' : undefined" :disabled="!position">
    <div v-if="open" ref="panel" class="panel" role="dialog" aria-label="选择表情" :style="position"
      :class="{ 'panel--fixed': position, 'panel--below': !position && preferred === 'below' }">
      <nav class="categories" aria-label="表情分类">
        <button type="button" :aria-pressed="!groupId" @click="loadFrequent">常用</button>
        <button v-for="group in orderedGroups" :key="group.oId" type="button" :aria-pressed="groupId === group.oId"
          :title="group.name" @click="loadGroup(group.oId)">
          {{ group.name || '分组' }}
        </button>
        <button v-if="catalogError || groupPage < groupPages" type="button" :disabled="catalogLoading"
          :title="catalogError || undefined" @click="loadCatalog(groupPage + 1)">
          {{ catalogError ? '重试分组' : '更多分组' }}
        </button>
      </nav>
      <section ref="selection" class="selection" :aria-label="selectedName" :aria-busy="loading">
        <h3>{{ selectedName }}</h3>
        <p v-if="error" class="hint" role="alert">{{ error }} <button v-if="retryItems" type="button" @click="retryItems()">重试</button></p>
        <FpLoading v-if="loading && !items.length" small />
        <div v-else class="grid">
          <button v-for="(item, index) in items" :key="item.oId || `${item.name}:${index}`"
            :disabled="Boolean(item.oId && !item.url)" type="button" :title="item.name" :aria-label="item.name" @click="pick(item)">
            <img v-if="previewImage(item)" :src="previewImage(item)" alt="" />
            <span v-else>{{ props.labels[item.name] || '⋯' }}</span>
          </button>
          <p v-if="!items.length && !error" class="hint">暂无表情</p>
        </div>
        <button v-if="groupId && itemPage < itemPages && !error" type="button" class="ghost more" :disabled="loading" @click="moreItems">更多表情</button>
      </section>
    </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.emoji {
  position: relative;
}
.trigger-icon { width: 17px; height: 17px; vertical-align: middle; }
.ghost {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-text);
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
}
.panel.panel--below { top: 42px; bottom: auto; }
.panel.panel--fixed { position: fixed; bottom: auto; z-index: 1500; }
.panel {
  position: absolute;
  bottom: 36px;
  left: 0;
  z-index: 8;
  display: grid;
  grid-template-columns: clamp(54px, 25%, 66px) minmax(0, 1fr);
  width: min(264px, calc(100vw - 16px));
  height: min(180px, 55dvh);
  box-sizing: border-box;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
}
.categories, .selection { min-height: 0; overflow: auto; }
.categories {
  padding: 5px;
  background: var(--fp-bg);
  border-right: 1px solid var(--fp-border);
}
.categories button {
  display: block;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--fp-muted);
  border-radius: 5px;
  padding: 5px 6px;
  cursor: pointer;
  font-size: 12px;
  text-align: left;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.categories button:hover, .grid button:hover { background: var(--fp-hover); }
.categories button[aria-pressed="true"] {
  background: var(--fp-card);
  color: var(--fp-link);
  font-weight: 600;
}
.selection { padding: 7px; }
.selection h3 { margin: 0 0 5px; color: var(--fp-muted); font-size: 12px; font-weight: 600; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, 22px); gap: 2px; }
.grid button {
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--fp-text);
  border-radius: 5px;
  cursor: pointer;
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 16px;
  line-height: 1;
}
.grid img { width: 20px; height: 20px; object-fit: contain; }
.more { display: block; margin: 5px auto 0; font-size: 12px; }
.hint { margin: 0; color: var(--fp-muted); font-size: 12px; grid-column: 1 / -1; }
</style>
