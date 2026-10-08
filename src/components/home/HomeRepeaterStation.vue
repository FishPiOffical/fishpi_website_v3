<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchRepeaterItems, likeRepeater, type RepeaterItem } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ initial?: RepeaterItem[] }>()

const auth = useAuthStore()
const { apiKey, isLoggedIn } = storeToRefs(auth)

const kinds = [
  { value: 'joke', label: '段子' },
  { value: 'kfc', label: '星期四' },
  { value: 'fish', label: '鱼科普' },
] as const

const kind = ref<(typeof kinds)[number]['value']>('joke')
const pool = ref<RepeaterItem[]>([])
const index = ref(0)
const busy = ref(false)
const msg = ref('')

const current = computed(() => pool.value[index.value] || null)
const typeLabel = computed(() => {
  const hit = kinds.find((k) => k.value === kind.value)
  return current.value?.repeaterContentTypeLabel || hit?.label || '段子'
})

async function load(reset = true) {
  busy.value = true
  msg.value = ''
  try {
    if (reset && kind.value === 'joke' && props.initial?.length) {
      pool.value = props.initial
    } else {
      pool.value = await fetchRepeaterItems(apiKey.value, kind.value)
    }
    index.value = 0
  } catch (e) {
    pool.value = []
    msg.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    busy.value = false
  }
}

watch(kind, () => void load(true))
watch(
  () => props.initial,
  (list) => {
    if (kind.value === 'joke' && list?.length && !pool.value.length) {
      pool.value = list
      index.value = 0
    } else if (!pool.value.length) {
      void load(true)
    }
  },
  { immediate: true },
)

function next() {
  if (!pool.value.length) {
    void load(false)
    return
  }
  index.value = (index.value + 1) % pool.value.length
}

async function copy() {
  if (!current.value?.repeaterContent) return
  try {
    await navigator.clipboard.writeText(current.value.repeaterContent)
    msg.value = '已复制'
  } catch {
    msg.value = '复制失败'
  }
}

async function like() {
  if (!apiKey.value || !current.value) return
  try {
    const data = await likeRepeater(apiKey.value, current.value.oId)
    if (data) {
      current.value.repeaterContentLiked = Boolean(data.liked)
      if (data.likeCount != null) current.value.repeaterContentLikeCount = data.likeCount
    }
  } catch (e) {
    msg.value = e instanceof Error ? e.message : '点赞失败'
  }
}

function strip(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
</script>

<template>
  <section class="repeater">
    <header class="head">
      <b>复读机转录站</b>
      <div class="tabs" role="tablist">
        <button
          v-for="k in kinds"
          :key="k.value"
          type="button"
          role="tab"
          :aria-selected="kind === k.value"
          :class="{ on: kind === k.value }"
          @click="kind = k.value"
        >
          {{ k.label }}
        </button>
      </div>
    </header>
    <p class="quote">{{ current ? strip(current.repeaterContent || '') : busy ? '加载中…' : '暂无内容' }}</p>
    <div class="meta">
      <span>{{ typeLabel }}</span>
      <RouterLink
        v-if="current?.repeaterContentAuthorName"
        :to="`/member/${current.repeaterContentAuthorName}`"
      >
        {{ current.repeaterContentAuthorName }}
      </RouterLink>
    </div>
    <div class="actions">
      <button type="button" @click="copy">复制</button>
      <button type="button" @click="next">换一个</button>
      <button v-if="isLoggedIn" type="button" class="like" @click="like">
        ♥ {{ current?.repeaterContentLikeCount || 0 }}
      </button>
      <RouterLink v-else to="/login" class="login">登录</RouterLink>
      <RouterLink to="/repeater" class="more">更多</RouterLink>
    </div>
    <p v-if="msg" class="msg">{{ msg }}</p>
  </section>
</template>

<style scoped>
.repeater {
  margin: 0 10px 8px;
  padding: 10px 12px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--fp-head);
}
.head b {
  font-weight: 700;
  flex-shrink: 0;
}
.tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.tabs button,
.actions button,
.actions a.login,
.actions a.more {
  border: 1px solid var(--fp-border);
  background: var(--fp-hover);
  color: var(--fp-text);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  text-decoration: none;
}
.tabs button.on {
  color: var(--fp-link);
  border-color: var(--fp-link);
}
.quote {
  margin: 0;
  font-size: 13px;
  color: var(--fp-title);
  line-height: 1.45;
  min-height: 2.8em;
}
.meta {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: var(--fp-muted);
}
.meta a {
  color: var(--fp-link);
  text-decoration: none;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.actions .like {
  color: var(--fp-accent);
}
.msg {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--fp-muted);
}
</style>
