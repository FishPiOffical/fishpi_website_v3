<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { fetchBreezemoons, postBreezemoon, removeBreezemoon, type Breezemoon } from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeBreezemoonsPayload } from '@/seo/payload'
import { useAuthStore } from '@/stores/auth'

usePageSeo(() => ({ title: '清风明月', path: '/breezemoons', description: '摸鱼派清风明月' }))

const auth = useAuthStore()
const { apiKey, isLoggedIn, account } = storeToRefs(auth)
const PAGE_SIZE = 30
const page = ref(1)
const myName = computed(() => account.value?.userName || '')
const items = ref<Breezemoon[]>([])
const error = ref('')
const loading = ref(true)
const draft = ref('')
const sending = ref(false)

async function load() {
  loading.value = true
  try {
    const cached = page.value === 1 ? consumeBreezemoonsPayload() : null
    items.value = cached || (await fetchBreezemoons(page.value, PAGE_SIZE))
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

watch([apiKey, page], () => void load(), { immediate: true })

const removing = ref('')
async function remove(item: Breezemoon) {
  if (!apiKey.value || !window.confirm('确定删除这条清风明月？')) return
  removing.value = item.oId
  try {
    await removeBreezemoon(apiKey.value, item.oId)
    items.value = items.value.filter((x) => x.oId !== item.oId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败'
  } finally {
    removing.value = ''
  }
}

async function submit() {
  if (!apiKey.value || !draft.value.trim()) return
  sending.value = true
  try {
    await postBreezemoon(apiKey.value, draft.value.trim())
    draft.value = ''
    if (page.value === 1) await load()
    else page.value = 1
  } catch (e) {
    error.value = e instanceof Error ? e.message : '发布失败'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <section class="card">
    <h1>清风明月</h1>
    <form v-if="isLoggedIn" class="composer" @submit.prevent="submit">
      <textarea v-model="draft" rows="2" placeholder="写一条清风明月" />
      <button type="submit" :disabled="sending || !draft.trim()">发布</button>
    </form>
    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <ol v-else>
      <li v-for="item in items" :key="item.oId">
        <img v-if="item.breezemoonAuthorThumbnailURL48" :src="item.breezemoonAuthorThumbnailURL48" alt="" />
        <div>
          <header>
            <b><RouterLink v-if="item.breezemoonAuthorName" :to="`/member/${item.breezemoonAuthorName}`">{{ item.breezemoonAuthorName }}</RouterLink></b>
            <time>{{ item.timeAgo }}</time>
            <span v-if="item.breezemoonCity">{{ item.breezemoonCity }}</span>
            <button
              v-if="myName && item.breezemoonAuthorName === myName"
              type="button"
              class="del"
              :disabled="removing === item.oId"
              @click="remove(item)"
            >
              删除
            </button>
          </header>
          <div class="body" v-html="item.breezemoonContent || ''" />
        </div>
      </li>
    </ol>
    <footer v-if="!loading && (page > 1 || items.length >= PAGE_SIZE)" class="pager">
      <button type="button" :disabled="page <= 1" @click="page -= 1">上一页</button>
      <span>{{ page }}</span>
      <button type="button" :disabled="items.length < PAGE_SIZE" @click="page += 1">下一页</button>
    </footer>
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
  margin: 0 0 12px;
  font-size: 18px;
}
.hint,
.err,
time,
span {
  color: var(--fp-muted);
  font-size: 13px;
}
.err {
  color: #e07a5f;
}
ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
li {
  display: flex;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--fp-border);
}
img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}
header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}
header a {
  color: inherit;
  text-decoration: none;
}
.body {
  font-size: 14px;
  line-height: 1.6;
  color: var(--fp-text);
  word-break: break-all;
  overflow-wrap: anywhere;
}
.body :deep(a) {
  word-break: break-all;
  overflow-wrap: anywhere;
}
.body :deep(p) {
  margin: 0;
  word-break: break-all;
  overflow-wrap: anywhere;
}
.del {
  margin-left: auto;
  border: 0;
  background: none;
  color: var(--fp-muted);
  font-size: 12px;
  cursor: pointer;
}
.del:hover {
  color: #e07a5f;
}
.pager {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  align-items: center;
}
.pager button {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-text);
  border-radius: 8px;
  padding: 4px 12px;
  cursor: pointer;
}
.composer {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.composer textarea {
  flex: 1;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 8px;
}
.composer button {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 8px;
  padding: 0 14px;
  cursor: pointer;
}
</style>
