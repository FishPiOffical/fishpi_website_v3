<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchRepeaterItems, likeRepeater, type RepeaterItem } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { apiKey, isLoggedIn } = storeToRefs(auth)
const items = ref<RepeaterItem[]>([])
const kind = ref('')
const loading = ref(true)
const error = ref('')
const actionMsg = ref('')

const kinds = [
  { value: '', label: '全部' },
  { value: 'joke', label: '段子' },
  { value: 'kfc', label: '疯狂星期四' },
  { value: 'fish', label: '鱼类科普' },
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await fetchRepeaterItems(apiKey.value, kind.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())
watch([apiKey, kind], () => void load())

async function like(item: RepeaterItem) {
  if (!apiKey.value) return
  actionMsg.value = ''
  try {
    const data = await likeRepeater(apiKey.value, item.oId)
    if (data) {
      item.repeaterContentLiked = Boolean(data.liked)
      if (data.likeCount != null) item.repeaterContentLikeCount = data.likeCount
    }
  } catch (e) {
    actionMsg.value = e instanceof Error ? e.message : '点赞失败'
  }
}
</script>

<template>
  <section class="card">
    <h1>复读机</h1>
    <p class="hint">转录站内容来自 <code>GET /api/repeater/items</code>。</p>
    <div class="tabs">
      <button
        v-for="k in kinds"
        :key="k.value"
        type="button"
        :class="{ on: kind === k.value }"
        @click="kind = k.value"
      >
        {{ k.label }}
      </button>
    </div>
    <p v-if="actionMsg" class="err">{{ actionMsg }}</p>
    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <ol v-else>
      <li v-for="item in items" :key="item.oId">
        <header>
          <b>
            <RouterLink v-if="item.repeaterContentAuthorName" :to="`/member/${item.repeaterContentAuthorName}`">
              {{ item.repeaterContentAuthorName }}
            </RouterLink>
            <span v-else>匿名</span>
          </b>
          <span>{{ item.repeaterContentTypeLabel || item.repeaterContentType }}</span>
        </header>
        <p>{{ item.repeaterContent }}</p>
        <button v-if="isLoggedIn" type="button" class="ghost" @click="like(item)">
          {{ item.repeaterContentLiked ? '已赞' : '赞' }} {{ item.repeaterContentLikeCount || 0 }}
        </button>
      </li>
    </ol>
    <p v-if="!loading && !error && !items.length" class="hint">还没有内容。</p>
  </section>
</template>

<style scoped>
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 18px 20px;
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
}
.tabs {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}
.tabs button,
.ghost {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-text);
  border-radius: 999px;
  padding: 4px 12px;
  cursor: pointer;
}
.tabs button.on {
  background: var(--fp-primary);
  color: #fff;
  border-color: transparent;
}
ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
li {
  padding: 12px 0;
  border-bottom: 1px solid var(--fp-border);
}
header {
  display: flex;
  gap: 8px;
  font-size: 13px;
  color: var(--fp-muted);
  margin-bottom: 6px;
}
header a {
  color: inherit;
  text-decoration: none;
}
</style>
