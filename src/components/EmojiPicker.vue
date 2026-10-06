<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  emojiToMarkdown,
  fetchEmojiGroups,
  fetchFrequentEmotions,
  fetchGroupEmojis,
  type EmojiItem,
} from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits<{ insert: [markdown: string] }>()

const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)
const open = ref(false)
const loading = ref(false)
const items = ref<EmojiItem[]>([])
const groups = ref<{ oId: string; name?: string }[]>([])
const groupId = ref('')

async function loadFrequent() {
  if (!apiKey.value) {
    items.value = []
    return
  }
  loading.value = true
  try {
    ;[items.value, groups.value] = await Promise.all([
      fetchFrequentEmotions(apiKey.value),
      fetchEmojiGroups(apiKey.value),
    ])
  } finally {
    loading.value = false
  }
}

async function loadGroup(id: string) {
  if (!apiKey.value || !id) return
  groupId.value = id
  loading.value = true
  try {
    items.value = await fetchGroupEmojis(apiKey.value, id)
  } finally {
    loading.value = false
  }
}

onMounted(() => void loadFrequent())
watch(apiKey, () => void loadFrequent())

function pick(item: EmojiItem) {
  emit('insert', emojiToMarkdown(item))
  open.value = false
}
</script>

<template>
  <div class="emoji">
    <button type="button" class="ghost" @click="open = !open">表情</button>
    <div v-if="open" class="panel">
      <div v-if="groups.length" class="tabs">
        <button type="button" :class="{ on: !groupId }" @click="groupId = ''; loadFrequent()">常用</button>
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
      <p v-if="loading" class="hint">加载表情…</p>
      <div v-else class="grid">
        <button v-for="item in items" :key="item.name + (item.url || '')" type="button" :title="item.name" @click="pick(item)">
          <img v-if="item.url" :src="item.url" :alt="item.name" />
          <span v-else>{{ item.text || item.name }}</span>
        </button>
        <p v-if="!items.length" class="hint">暂无表情</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.emoji {
  position: relative;
}
.ghost {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-text);
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
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
