<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  addEmojiUrl,
  createEmojiGroup,
  deleteEmojiGroup,
  fetchEmojiGroups,
  fetchGroupEmojis,
  removeGroupEmoji,
  type EmojiGroup,
  type EmojiItem,
} from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import FpLoading from '@/components/FpLoading.vue'

const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)
const groups = ref<EmojiGroup[]>([])
const items = ref<EmojiItem[]>([])
const groupId = ref('')
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const newGroup = ref('')
const newUrl = ref('')
const newName = ref('')

async function loadGroups() {
  if (!apiKey.value) return
  loading.value = true
  error.value = ''
  try {
    groups.value = await fetchEmojiGroups(apiKey.value)
    if (!groupId.value && groups.value[0]) groupId.value = groups.value[0].oId
    else await loadItems()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '分组加载失败'
  } finally {
    loading.value = false
  }
}

async function loadItems() {
  if (!apiKey.value || !groupId.value) {
    items.value = []
    return
  }
  loading.value = true
  try {
    items.value = await fetchGroupEmojis(apiKey.value, groupId.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '表情加载失败'
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => void loadGroups())
watch(apiKey, () => void loadGroups())
watch(groupId, () => void loadItems())

async function onCreate() {
  if (!apiKey.value || !newGroup.value.trim()) return
  busy.value = true
  error.value = ''
  try {
    await createEmojiGroup(apiKey.value, newGroup.value.trim(), groups.value.length)
    newGroup.value = ''
    await loadGroups()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败'
  } finally {
    busy.value = false
  }
}

async function onDeleteGroup() {
  if (!apiKey.value || !groupId.value) return
  busy.value = true
  error.value = ''
  try {
    await deleteEmojiGroup(apiKey.value, groupId.value)
    groupId.value = ''
    await loadGroups()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败'
  } finally {
    busy.value = false
  }
}

async function onAddUrl() {
  if (!apiKey.value || !groupId.value || !newUrl.value.trim()) return
  busy.value = true
  error.value = ''
  try {
    await addEmojiUrl(apiKey.value, groupId.value, newUrl.value.trim(), items.value.length, newName.value.trim())
    newUrl.value = ''
    newName.value = ''
    await loadItems()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '添加失败'
  } finally {
    busy.value = false
  }
}

async function onRemove(item: EmojiItem) {
  if (!apiKey.value || !groupId.value || !item.oId) return
  busy.value = true
  error.value = ''
  try {
    await removeGroupEmoji(apiKey.value, groupId.value, item.oId)
    await loadItems()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '移除失败'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card">
    <h1>表情分组</h1>
    <p class="hint">列表来自 <code>GET /api/emoji/groups</code>。增删会写到现网，请只改自己的分组。</p>
    <p v-if="error" class="err">{{ error }}</p>
    <FpLoading v-if="loading" small />
    <div v-if="groups.length" class="tabs">
      <button
        v-for="g in groups"
        :key="g.oId"
        type="button"
        :class="{ on: groupId === g.oId }"
        @click="groupId = g.oId"
      >
        {{ g.name || '分组' }}
      </button>
    </div>
    <p v-else-if="!loading" class="hint">还没有自定义分组。</p>
    <div class="grid">
      <figure v-for="item in items" :key="item.oId || item.name + (item.url || '')">
        <img v-if="item.url" :src="item.url" :alt="item.name" />
        <figcaption>{{ item.name }}</figcaption>
        <button v-if="item.oId" type="button" class="ghost" :disabled="busy" @click="onRemove(item)">移除</button>
      </figure>
    </div>
    <form class="row" @submit.prevent="onAddUrl">
      <input v-model="newUrl" placeholder="图片 URL" />
      <input v-model="newName" placeholder="名称（可选）" />
      <button type="submit" :disabled="busy || !groupId || !newUrl.trim()">添加到分组</button>
    </form>
    <form class="row" @submit.prevent="onCreate">
      <input v-model="newGroup" placeholder="新分组名称" />
      <button type="submit" :disabled="busy || !newGroup.trim()">新建分组</button>
      <button type="button" class="ghost" :disabled="busy || !groupId" @click="onDeleteGroup">删除当前分组</button>
    </form>
  </section>
</template>

<style scoped>
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 24px;
}
h1 {
  margin: 0 0 8px;
  font-size: 18px;
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.err {
  color: #e07a5f;
  font-size: 13px;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0;
}
.tabs button,
.ghost,
.row button {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-text);
  border-radius: 8px;
  padding: 4px 10px;
  cursor: pointer;
}
.tabs button.on {
  background: var(--fp-primary);
  color: #fff;
  border-color: transparent;
}
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 12px 0;
}
figure {
  margin: 0;
  width: 72px;
  text-align: center;
  font-size: 11px;
  color: var(--fp-muted);
}
img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.row input {
  flex: 1;
  min-width: 140px;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 6px 8px;
}
.row button[type='submit'] {
  background: var(--fp-primary);
  color: #fff;
  border-color: transparent;
}
</style>
