<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { fetchBreezemoons, postBreezemoon, type Breezemoon } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { apiKey, isLoggedIn } = storeToRefs(auth)
const items = ref<Breezemoon[]>([])
const error = ref('')
const loading = ref(true)
const draft = ref('')
const sending = ref(false)

async function load() {
  loading.value = true
  try {
    items.value = await fetchBreezemoons(1, 30)
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())

async function submit() {
  if (!apiKey.value || !draft.value.trim()) return
  sending.value = true
  try {
    await postBreezemoon(apiKey.value, draft.value.trim())
    draft.value = ''
    await load()
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
          </header>
          <div class="body" v-html="item.breezemoonContent || ''" />
        </div>
      </li>
    </ol>
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
.body :deep(p) {
  margin: 0;
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
