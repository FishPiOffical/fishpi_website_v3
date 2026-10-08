<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchPointRecords, fetchUserPoint, type PointRecord } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import { usePageSeo } from '@/composables/usePageSeo'
import FpLoading from '@/components/FpLoading.vue'
import { createSwrLoader } from '@/utils/swr'

const auth = useAuthStore()
const { apiKey, account, isLoggedIn } = storeToRefs(auth)
const items = ref<PointRecord[]>([])
const balance = ref<number | null>(null)
const page = ref(1)
const loading = ref(false)
const error = ref('')

usePageSeo(() => ({ title: '积分流水', path: '/points', robots: 'noindex' }))

const userName = computed(() => account.value?.userName || '')

const swr = createSwrLoader({ loading, error })

async function load() {
  const key = apiKey.value
  const name = userName.value
  if (!key || !name) return
  await swr(
    `points:${page.value}`,
    async () => {
      const [records, point] = await Promise.all([fetchPointRecords(key, page.value), fetchUserPoint(name, key)])
      return { records, point: point ? point.userPoint : (account.value?.userPoint ?? null) }
    },
    (data) => {
      items.value = data.records
      balance.value = data.point
    },
    '积分流水失败',
  )
}

watch(
  () => [apiKey.value, userName.value, page.value],
  () => void load(),
  { immediate: true },
)

function sumClass(r: PointRecord) {
  if (r.type === '-') return 'out'
  if (r.type === '+') return 'in'
  return ''
}

function sumText(r: PointRecord) {
  if (r.sum == null) return ''
  const n = Number(r.sum)
  if (r.type === '-') return `-${n}`
  if (r.type === '+') return `+${n}`
  return String(n)
}
</script>

<template>
  <section class="card">
    <h1>积分流水</h1>
    <p v-if="!isLoggedIn" class="hint">
      <RouterLink to="/login">登录</RouterLink>
      后查看积分余额与变动。
    </p>
    <template v-else>
      <p v-if="balance != null" class="balance">
        当前积分 <b>{{ balance.toLocaleString() }}</b>
      </p>
      <p class="hint">
        <RouterLink to="/settings/point">积分转账</RouterLink>
        ·
        <RouterLink to="/activity">活动签到</RouterLink>
      </p>
      <p class="hint">
        流水来自 <code>GET /api/getNotifications?type=point</code>；余额来自
        <code>GET /user/:name/point</code>。
      </p>
      <FpLoading v-if="loading" />
      <p v-else-if="error" class="err">{{ error }}</p>
      <ol v-else>
        <li v-if="!items.length" class="hint">暂无记录</li>
        <li v-for="(r, i) in items" :key="r.oId || i">
          <div class="row">
            <div class="desc" v-html="r.description || r.type || '积分变动'" />
            <em v-if="r.sum != null" :class="sumClass(r)">{{ sumText(r) }}</em>
          </div>
          <span>{{ r.time || r.createTime }}</span>
        </li>
      </ol>
      <footer class="pager">
        <button type="button" :disabled="page <= 1" @click="page -= 1">上一页</button>
        <span>{{ page }}</span>
        <button type="button" :disabled="items.length < 10" @click="page += 1">下一页</button>
      </footer>
    </template>
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
.balance {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--fp-head);
}
.balance b {
  color: var(--fp-green);
  font-size: 20px;
  margin-left: 6px;
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.hint a {
  color: var(--fp-link);
}
.hint code {
  font-size: 12px;
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
.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}
.desc {
  min-width: 0;
  flex: 1;
}
span {
  color: var(--fp-muted);
  font-size: 12px;
}
em {
  font-style: normal;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}
em.in {
  color: var(--fp-income);
}
em.out {
  color: var(--fp-accent);
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
