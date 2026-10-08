<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { fetchPublicLogs, type PublicLog } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import FpLoading from '@/components/FpLoading.vue'

const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)
const items = ref<PublicLog[]>([])
const page = ref(1)
const loading = ref(true)
const error = ref('')

async function load() {
  if (!apiKey.value) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    items.value = await fetchPublicLogs(apiKey.value, page.value, 20)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())
watch([apiKey, page], () => void load())
</script>

<template>
  <section class="card">
    <h1>公开日志</h1>
    <p class="hint">来自 <code>GET /logs/more</code> 的公开操作记录。</p>
    <FpLoading v-if="loading" />
    <p v-else-if="error" class="err">{{ error }}</p>
    <ol v-else>
      <li v-for="(item, i) in items" :key="item.oId || i">
        <header>
          <b>{{ item.key3 || '操作' }}</b>
          <time>{{ item.key1 }}</time>
        </header>
        <p>{{ item.data }}</p>
      </li>
    </ol>
    <p v-if="!loading && !error && !items.length" class="hint">暂无公开日志。</p>
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
ol {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}
li {
  padding: 10px 0;
  border-bottom: 1px solid var(--fp-border);
}
header {
  display: flex;
  gap: 8px;
  font-size: 13px;
  color: var(--fp-muted);
}
p {
  margin: 6px 0 0;
}
.pager {
  display: flex;
  gap: 12px;
  margin-top: 12px;
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
