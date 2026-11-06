<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
const root = ref<HTMLElement | null>(null)
const items = ref<EmojiItem[]>([]), groups = ref<EmojiGroup[]>([]), groupId = ref('')
const groupPage = ref(0), groupPages = ref(0), itemPage = ref(0), itemPages = ref(0)
let version = 0
async function load<T>(fetcher: () => Promise<T>, apply: (value: T) => void) {
  const reader = identity(), request = ++version
  if (!accessToken.value) { error.value = '请先登录后使用表情'; return }
  loading.value = true; error.value = ''
  try { const value = await fetcher(); if (request === version && reader === identity()) apply(value) }
  catch (failure) { if (request === version && reader === identity()) { items.value = []; error.value = failure instanceof Error ? failure.message : '表情加载失败' } }
  finally { if (request === version) loading.value = false }
}
function loadFrequent() {
  groupId.value = ''; items.value = []; itemPage.value = itemPages.value = 0
  return load(() => Promise.all([fetchV3FrequentEmotions(), fetchV3EmojiGroups()]), ([frequent, page]) => {
    items.value = frequent; groups.value = page.list; groupPage.value = page.p; groupPages.value = page.pageCount
  })
}
function loadGroup(id: string) {
  groupId.value = id; items.value = []; itemPage.value = itemPages.value = 0
  return load(() => fetchV3GroupEmojis(id), page => { items.value = page.list; itemPage.value = page.p; itemPages.value = page.pageCount })
}
function moreGroups() {
  return load(() => fetchV3EmojiGroups(groupPage.value + 1), page => {
    groups.value = Array.from(new Map([...groups.value, ...page.list].map(group => [group.oId, group])).values())
    groupPage.value = page.p; groupPages.value = page.pageCount
  })
}
function moreItems() {
  const id = groupId.value, p = itemPage.value + 1
  return load(() => fetchV3GroupEmojis(id, p), page => { items.value = [...items.value, ...page.list]; itemPage.value = page.p; itemPages.value = page.pageCount })
}
function toggle() { open.value = !open.value; if (open.value) void loadFrequent(); else { version++; loading.value = false } }
function close() { if (open.value) { open.value = false; version++; loading.value = false } }
function outside(event: Event) { if (open.value && event.target instanceof Node && !root.value?.contains(event.target)) close() }
function escape(event: KeyboardEvent) { if (event.key === 'Escape') close() }
onMounted(() => { if (typeof document !== 'undefined') { document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape) } })
watch(identity, () => { version++; open.value = false; loading.value = false; error.value = ''; items.value = []; groups.value = []; groupId.value = '' }, { flush: 'sync' })
onBeforeUnmount(() => { version++; if (typeof document !== 'undefined') { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) } })
function pick(item: EmojiItem) {
  if (!open.value || loading.value || !accessToken.value || item.oId && !item.url) return
  emit('insert', emojiToMarkdown(item)); open.value = false; version++; loading.value = false
}
defineExpose({ toggle })
</script>

<template>
  <div ref="root" class="emoji">
    <button v-if="props.showTrigger" type="button" class="ghost" :aria-expanded="open" aria-label="表情" @click="toggle"><svg class="trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 14c1 4 7 4 8 0M8 9h.01M16 9h.01" stroke-linecap="round" /></svg><span>表情</span></button>
    <div v-if="open" class="panel" :class="{ 'panel--below': props.placement === 'below' }">
      <div v-if="groups.length" class="tabs">
        <button type="button" :class="{ on: !groupId }" @click="loadFrequent">常用</button>
        <button
          v-for="g in groups"
          :key="g.oId"
          type="button"
          :class="{ on: groupId === g.oId }"
          @click="loadGroup(g.oId)"
        >
          {{ g.name || '分组' }}
        </button>
      </div>
      <button v-if="groupPage < groupPages" type="button" class="ghost" :disabled="loading" @click="moreGroups">更多分组</button>
      <p v-if="error" class="hint" role="alert">{{ error }} <button type="button" @click="groupId ? loadGroup(groupId) : loadFrequent()">重试</button></p>
      <FpLoading v-if="loading" small />
      <div v-else class="grid" :class="{ 'grid--aliases': items.some(item => !item.url && !props.labels[item.name]) }">
        <button v-for="(item, index) in items" :key="item.oId || `${item.name}:${index}`" :disabled="Boolean(item.oId && !item.url)" type="button" :title="item.name" @click="pick(item)">
          <img v-if="item.url" :src="item.url" :alt="item.name" />
          <span v-else>{{ props.labels[item.name] || item.text || item.name }}</span>
        </button>
        <p v-if="!items.length && !error" class="hint">暂无表情</p>
      </div>
      <button v-if="groupId && itemPage < itemPages" type="button" class="ghost" :disabled="loading" @click="moreItems">更多表情</button>
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
.grid.grid--aliases {
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
}
.panel.panel--below {
  top: 42px;
  bottom: auto;
}
.panel {
  position: absolute;
  bottom: 36px;
  left: 0;
  z-index: 8;
  width: min(360px, 70vw);
  max-height: 240px;
  overflow: auto;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  padding: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.tabs button {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-muted);
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 12px;
}
.tabs button.on {
  color: var(--fp-link);
  border-color: var(--fp-primary);
}
.grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
}
.grid button {
  border: 0;
  background: var(--fp-hover);
  border-radius: 6px;
  padding: 4px;
  cursor: pointer;
  min-height: 32px;
}
.grid img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}
.hint {
  margin: 0;
  color: var(--fp-muted);
  font-size: 12px;
  grid-column: 1 / -1;
}
</style>
