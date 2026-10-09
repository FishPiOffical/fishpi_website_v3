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
  <div class="points-view">
    <section v-if="!isLoggedIn" class="card empty-state">
      <h1>积分流水</h1>
      <p class="hint">
        请先 <RouterLink to="/login">登录</RouterLink> 后查看积分余额与变动。
      </p>
    </section>

    <template v-else>
      <!-- 资产概览卡片 -->
      <section class="balance-card">
        <div class="balance-info">
          <span class="balance-label">当前可用积分</span>
          <div class="balance-value">
            <span class="currency-icon">💠</span>
            <strong>{{ balance != null ? balance.toLocaleString() : '...' }}</strong>
          </div>
        </div>
        <div class="balance-actions">
          <RouterLink to="/charge/point" class="action-btn primary">
            <span class="icon">💰</span> 充值积分
          </RouterLink>
          <RouterLink to="/settings/point" class="action-btn">
            <span class="icon">💸</span> 积分转账
          </RouterLink>
          <RouterLink to="/activity" class="action-btn">
            <span class="icon">📅</span> 活动签到
          </RouterLink>
        </div>
      </section>

      <!-- 流水列表 -->
      <section class="card records-section">
        <header class="section-header">
          <h2>积分流水</h2>
          <span class="api-hint">
            流水：<code>GET /api/getNotifications?type=point</code>
          </span>
        </header>

        <FpLoading v-if="loading" class="loading-wrap" />
        <p v-else-if="error" class="err">{{ error }}</p>
        <div v-else class="records-list">
          <div v-if="!items.length" class="empty-list">暂无记录</div>
          <div v-for="(r, i) in items" :key="r.oId || i" class="record-item">
            <div class="record-icon" :class="sumClass(r)">
              {{ r.type === '+' ? '+' : '-' }}
            </div>
            <div class="record-main">
              <div class="record-desc" v-html="r.description || r.type || '积分变动'" />
              <div class="record-time">{{ r.time || r.createTime }}</div>
            </div>
            <div class="record-amount" :class="sumClass(r)">
              {{ sumText(r) }}
            </div>
          </div>
        </div>

        <footer class="pager" v-if="items.length || page > 1">
          <button type="button" class="pager-btn" :disabled="page <= 1" @click="page -= 1">上一页</button>
          <span class="page-num">{{ page }}</span>
          <button type="button" class="pager-btn" :disabled="items.length < 10" @click="page += 1">下一页</button>
        </footer>
      </section>
    </template>
  </div>
</template>

<style scoped>
.points-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 900px;
  margin: 0 auto;
}
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
}
.empty-state {
  text-align: center;
  padding: 48px 24px;
}
.empty-state h1 {
  margin: 0 0 16px;
  font-size: 20px;
  color: var(--fp-title);
}
.hint {
  color: var(--fp-muted);
  font-size: 14px;
}
.hint a {
  color: var(--fp-link);
  text-decoration: none;
}
.hint a:hover {
  text-decoration: underline;
}

/* 资产概览卡片 */
.balance-card {
  background: linear-gradient(135deg, var(--fp-card) 0%, color-mix(in srgb, var(--fp-primary) 10%, var(--fp-card)) 100%);
  border: 1px solid color-mix(in srgb, var(--fp-primary) 20%, var(--fp-border));
  border-radius: 12px;
  padding: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 24px;
}
.balance-label {
  display: block;
  font-size: 14px;
  color: var(--fp-muted);
  margin-bottom: 8px;
}
.balance-value {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fp-title);
}
.currency-icon {
  font-size: 28px;
}
.balance-value strong {
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
}
.balance-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  background: var(--fp-bg);
  color: var(--fp-text);
  border: 1px solid var(--fp-border);
  transition: all 0.2s;
}
.action-btn:hover {
  border-color: var(--fp-primary);
  color: var(--fp-primary);
}
.action-btn.primary {
  background: var(--fp-primary);
  color: #fff;
  border-color: var(--fp-primary);
}
.action-btn.primary:hover {
  filter: brightness(1.1);
  color: #fff;
}

/* 流水列表区 */
.records-section {
  padding: 0;
  display: flex;
  flex-direction: column;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--fp-border);
}
.section-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--fp-title);
}
.api-hint {
  font-size: 12px;
  color: var(--fp-muted);
  opacity: 0.6;
}
.api-hint code {
  background: var(--fp-bg);
  padding: 2px 6px;
  border-radius: 4px;
}
.loading-wrap, .empty-list, .err {
  padding: 48px 24px;
  text-align: center;
  color: var(--fp-muted);
}
.err {
  color: #e07a5f;
}
.records-list {
  display: flex;
  flex-direction: column;
}
.record-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--fp-border);
  transition: background 0.2s;
}
.record-item:hover {
  background: var(--fp-bg);
}
.record-item:last-child {
  border-bottom: none;
}
.record-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  flex-shrink: 0;
  background: var(--fp-bg);
  color: var(--fp-muted);
}
.record-icon.in {
  background: color-mix(in srgb, var(--fp-income) 15%, transparent);
  color: var(--fp-income);
}
.record-icon.out {
  background: color-mix(in srgb, var(--fp-accent) 15%, transparent);
  color: var(--fp-accent);
}
.record-main {
  flex: 1;
  min-width: 0;
}
.record-desc {
  font-size: 15px;
  color: var(--fp-text);
  margin-bottom: 4px;
  word-break: break-word;
}
:deep(.record-desc a) {
  color: var(--fp-link);
  text-decoration: none;
}
:deep(.record-desc a:hover) {
  text-decoration: underline;
}
.record-time {
  font-size: 13px;
  color: var(--fp-muted);
}
.record-amount {
  font-size: 18px;
  font-weight: 600;
  font-family: monospace;
}
.record-amount.in {
  color: var(--fp-income);
}
.record-amount.out {
  color: var(--fp-text);
}

/* 分页 */
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px 24px;
  border-top: 1px solid var(--fp-border);
}
.pager-btn {
  border: 1px solid var(--fp-border);
  background: var(--fp-bg);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 6px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}
.pager-btn:not(:disabled):hover {
  border-color: var(--fp-primary);
  color: var(--fp-primary);
}
.pager-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.page-num {
  font-size: 14px;
  font-weight: 600;
  color: var(--fp-title);
  min-width: 24px;
  text-align: center;
}

@media (max-width: 640px) {
  .balance-card {
    padding: 24px;
    flex-direction: column;
    align-items: flex-start;
  }
  .balance-actions {
    width: 100%;
  }
  .action-btn {
    flex: 1;
    justify-content: center;
    padding: 10px 8px;
  }
  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .record-item {
    padding: 12px 16px;
    gap: 12px;
  }
  .record-icon {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }
  .record-amount {
    font-size: 16px;
  }
}
</style>