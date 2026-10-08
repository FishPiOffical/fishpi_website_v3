<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchPointRecords, type PointRecord } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)
const items = ref<PointRecord[]>([])
const page = ref(1)
const loading = ref(false)
const error = ref('')
const fromNotice = computed(() => items.value.some((r) => String(r.oId || '').startsWith('notice-')))

async function load() {
  if (!apiKey.value) return
  loading.value = true
  error.value = ''
  try {
    items.value = await fetchPointRecords(apiKey.value, page.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '积分流水失败'
    items.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [apiKey.value, page.value],
  () => void load(),
  { immediate: true },
)
</script>

<template>
  <section class="card">
    <h1>积分流水</h1>
    <p class="hint">
      <RouterLink to="/settings/point">积分转账</RouterLink>
      ·
      <RouterLink to="/activity">活动签到</RouterLink>
    </p>
    <p v-if="fromNotice" class="hint">独立流水接口未开放时，回退到积分通知列表。</p>
    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <ol v-else>
      <li v-if="!items.length" class="hint">暂无记录</li>
      <li v-for="(r, i) in items" :key="r.oId || i">
        <div v-html="r.description || r.type || '积分变动'" />
        <span>{{ r.time || r.createTime }}</span>
        <em v-if="r.sum != null">{{ r.sum }}</em>
      </li>
    </ol>
    <footer class="pager">
      <button type="button" :disabled="page <= 1" @click="page -= 1">上一页</button>
      <span>{{ page }}</span>
      <button type="button" :disabled="items.length < 10" @click="page += 1">下一页</button>
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
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.hint a {
  color: var(--fp-link);
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
  padding: 10px 0;
  border-bottom: 1px solid var(--fp-border);
  font-size: 14px;
}
span,
em {
  color: var(--fp-muted);
  font-size: 12px;
  font-style: normal;
  margin-right: 8px;
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
</style>
