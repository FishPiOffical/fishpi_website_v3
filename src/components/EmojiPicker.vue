<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { emojiToMarkdown, type EmojiItem, type EmojiGroup } from '@/api/fishpi'
import { getAuthContextVersion } from '@/api/http'
import { fetchV3FrequentEmotions, fetchV3EmojiGroups, fetchV3GroupEmojis } from '@/api/v3-emojis'
import { useAuthStore } from '@/stores/auth'
import FpLoading from '@/components/FpLoading.vue'

const props = withDefaults(defineProps<{ showTrigger?: boolean; placement?: 'above' | 'below'; labels?: Record<string, string> }>(), { showTrigger: true, placement: 'above', labels: () => ({}) })
const emit = defineEmits<{ insert: [markdown: string] }>()
const { accessToken, account } = storeToRefs(useAuthStore())
const identity = () => JSON.stringify([getAuthContextVersion(), !!accessToken.value, account.value?.oId || ''])
const open = ref(false), loading = ref(false), error = ref('')
const root = ref<HTMLElement | null>(null), selection = ref<HTMLElement | null>(null)
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
function toggle() {
  if (open.value) { close(); return }
  open.value = true
  groupPage.value = groupPages.value = 0
  groups.value = []
  catalogError.value = ''
  void loadFrequent()
  void loadCatalog()
}
function close() {
  retryItems = undefined
  open.value = false
  version++; catalogVersion++
  loading.value = catalogLoading.value = false
}
function outside(event: Event) { if (open.value && event.target instanceof Node && !root.value?.contains(event.target)) close() }
function escape(event: KeyboardEvent) { if (event.key === 'Escape') close() }
onMounted(() => { if (typeof document !== 'undefined') { document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape) } })
watch(identity, () => { close(); error.value = catalogError.value = ''; items.value = []; groups.value = []; groupId.value = '' }, { flush: 'sync' })
onBeforeUnmount(() => { close(); if (typeof document !== 'undefined') { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) } })
function pick(item: EmojiItem) {
  if (!open.value || loading.value || !accessToken.value || item.oId && !item.url) return
  emit('insert', emojiToMarkdown(item)); close()
}
defineExpose({ toggle })
</script>

<template>
  <div ref="root" class="emoji">
    <button v-if="props.showTrigger" type="button" class="ghost" :aria-expanded="open" aria-label="表情" @click="toggle"><svg class="trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 14c1 4 7 4 8 0M8 9h.01M16 9h.01" stroke-linecap="round" /></svg><span>表情</span></button>
    <div v-if="open" class="panel" :class="{ 'panel--below': props.placement === 'below' }">
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
        <div v-else class="grid" :class="{ 'grid--aliases': items.some(item => !item.url && !props.labels[item.name]) }">
          <button v-for="(item, index) in items" :key="item.oId || `${item.name}:${index}`"
            :disabled="Boolean(item.oId && !item.url)" type="button" :title="item.name" :aria-label="item.name" @click="pick(item)">
            <img v-if="item.url" :src="item.url" alt="" loading="lazy" />
            <span v-else>{{ props.labels[item.name] || item.text || item.name }}</span>
          </button>
          <p v-if="!items.length && !error" class="hint">暂无表情</p>
        </div>
        <button v-if="groupId && itemPage < itemPages && !error" type="button" class="ghost more" :disabled="loading" @click="moreItems">更多表情</button>
      </section>
    </div>
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
.panel {
  position: absolute;
  bottom: 36px;
  left: 0;
  z-index: 8;
  display: grid;
  grid-template-columns: clamp(66px, 23%, 88px) minmax(0, 1fr);
  width: min(360px, calc(100vw - 32px));
  height: min(234px, 55dvh);
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
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(29px, 1fr)); gap: 2px; }
.grid--aliases { grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); }
.grid button {
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--fp-text);
  border-radius: 5px;
  padding: 2px;
  cursor: pointer;
  min-height: 29px;
  font-size: 18px;
}
.grid--aliases button { font-size: 12px; overflow-wrap: anywhere; }
.grid img { width: 24px; height: 24px; object-fit: contain; }
.more { display: block; margin: 5px auto 0; font-size: 12px; }
.hint { margin: 0; color: var(--fp-muted); font-size: 12px; grid-column: 1 / -1; }
</style>
