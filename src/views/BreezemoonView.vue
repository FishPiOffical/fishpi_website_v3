<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchBreezemoons, type Breezemoon } from '@/api/fishpi'

const items = ref<Breezemoon[]>([])
const error = ref('')
const loading = ref(true)

onMounted(async () => {
  try {
    items.value = await fetchBreezemoons(1, 30)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="card">
    <h1>清风明月</h1>
    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <ol v-else>
      <li v-for="item in items" :key="item.oId">
        <img v-if="item.breezemoonAuthorThumbnailURL48" :src="item.breezemoonAuthorThumbnailURL48" alt="" />
        <div>
          <header>
            <b>{{ item.breezemoonAuthorName }}</b>
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
.body :deep(p) {
  margin: 0;
}
</style>
