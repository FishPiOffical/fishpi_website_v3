<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { fetchV3PointBalance, fetchV3PointPage, pointChange, pointTime, type PointEntry } from '@/api/v3-points'
import { useAuthStore } from '@/stores/auth'
import { usePageSeo } from '@/composables/usePageSeo'
import FpLoading from '@/components/FpLoading.vue'
const { accessToken, account } = storeToRefs(useAuthStore())
const mounted = ref(false), items = ref<PointEntry[]>([]), balance = ref<number | null>(null)
const page = ref(1), pageCount = ref(0), total = ref(0), loading = ref(false), balanceLoading = ref(false), error = ref(''), balanceError = ref('')
const loggedIn = computed(() => mounted.value && !!accessToken.value && !!account.value)
let sequence = 0, balanceSequence = 0, boundary = getAuthContextVersion(), owner = account.value?.oId
usePageSeo(() => ({ title: '积分流水', path: '/points', robots: 'noindex' }))
function clear() { sequence++; balanceSequence++; items.value = []; balance.value = null; pageCount.value = total.value = 0; error.value = balanceError.value = ''; loading.value = balanceLoading.value = false }
function capture(current: number, balanceRead = false) { const context = getAuthContextVersion(), id = account.value?.oId; return () => loggedIn.value && context === getAuthContextVersion() && id === account.value?.oId && current === (balanceRead ? balanceSequence : sequence) }
async function loadRecords() {
  const valid = capture(++sequence), requested = page.value
  if (!valid()) return
  items.value = []; pageCount.value = total.value = 0; loading.value = true; error.value = ''
  try { const result = await fetchV3PointPage(requested); if (valid()) { items.value = result.list; pageCount.value = result.pageCount; total.value = result.total } }
  catch (e) { if (valid()) error.value = e instanceof Error ? e.message : '积分流水读取失败' }
  finally { if (valid()) loading.value = false }
}
async function loadBalance() {
  const valid = capture(++balanceSequence, true)
  if (!valid()) return
  balance.value = null; balanceLoading.value = true; balanceError.value = ''
  try { const value = await fetchV3PointBalance(); if (valid()) balance.value = value }
  catch (e) { if (valid()) balanceError.value = e instanceof Error ? e.message : '当前余额读取失败' }
  finally { if (valid()) balanceLoading.value = false }
}
watch([accessToken, () => account.value?.oId], () => {
  const context = getAuthContextVersion(), id = account.value?.oId
  if (!accessToken.value || context !== boundary || id !== owner) { const changedPage = page.value !== 1; clear(); page.value = 1; if (loggedIn.value) { if (!changedPage) void loadRecords(); void loadBalance() } }
  boundary = context; owner = id
}, { flush: 'sync' })
watch(page, () => { if (loggedIn.value) void loadRecords() })
onMounted(() => { mounted.value = true; if (loggedIn.value) { void loadRecords(); void loadBalance() } })
onBeforeUnmount(() => { mounted.value = false; clear() })
function refresh() { void loadRecords(); void loadBalance() }
</script>

<template>
  <div class="points-view">
    <section v-if="!loggedIn" class="card empty-state">
      <h1>积分流水</h1><p class="hint">请先 <RouterLink to="/login?redirect=/points">登录</RouterLink> 后查看积分余额与变动。</p>
    </section>
    <template v-else>
      <section class="balance-card">
        <div class="balance-info"><span class="balance-label">当前可用积分</span><div class="balance-value"><span class="currency-icon">💠</span><strong>{{ balance !== null ? balance.toLocaleString() : balanceLoading ? '读取中…' : '—' }}</strong></div><p v-if="balanceError" role="alert" class="err">{{ balanceError }} <button type="button" @click="loadBalance">重试余额读取</button></p></div>
        <div class="balance-actions"><RouterLink to="/charge/point" class="action-btn primary">💰 充值积分</RouterLink><RouterLink to="/settings/point" class="action-btn">💸 积分转账</RouterLink><RouterLink to="/activity" class="action-btn">📅 活动签到</RouterLink></div>
      </section>
      <section class="card records-section">
        <header class="section-header"><h2>积分流水</h2><button type="button" :disabled="loading || balanceLoading" @click="refresh">刷新余额与流水</button></header>
        <FpLoading v-if="loading" class="loading-wrap" />
        <div v-else-if="error" role="alert" class="err">{{ error }} <button type="button" @click="loadRecords">重试流水读取</button></div>
        <template v-else>
          <p>共 {{ total }} 条记录</p>
          <div class="records-list">
            <div v-if="!items.length" class="empty-list">{{ total ? '本页暂无记录，请返回已有页码' : '暂无记录' }}</div>
            <div v-for="(row, index) in items" :key="`${page}-${index}`" class="record-item">
              <div class="record-icon" :class="row.operation === '-' ? 'out' : 'in'">{{ row.operation }}</div>
              <div class="record-main"><div class="record-desc" v-html="row.descriptionHtml" /><div>{{ row.displayType }}</div><div class="record-time">{{ pointTime(row.time) }}</div><div>交易后余额：{{ row.balance.toLocaleString() }}</div></div>
              <div class="record-amount" :class="row.operation === '-' ? 'out' : 'in'">{{ pointChange(row) }}</div>
            </div>
          </div>
          <footer v-if="total || page > 1" class="pager"><button type="button" class="pager-btn" :disabled="page <= 1" @click="page--">上一页</button><span class="page-num">{{ page }} / {{ pageCount }}</span><button type="button" class="pager-btn" :disabled="page >= Math.min(pageCount, 42949672)" @click="page++">下一页</button></footer>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
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