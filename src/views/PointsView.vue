<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { fetchV3PointBalance, fetchV3PointPage, pointChange, pointTime, type PointEntry } from '@/api/v3-points'
import { useAuthStore } from '@/stores/auth'
import { usePageSeo } from '@/composables/usePageSeo'
import FpLoading from '@/components/FpLoading.vue'
defineProps<{ embedded?: boolean }>()
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
function direction(row: PointEntry) {
  const change = row.operation === '-' ? -row.amount : row.amount
  return change > 0 ? 'income' : change < 0 ? 'expense' : 'neutral'
}
function refresh() { void loadRecords(); void loadBalance() }
</script>

<template>
  <div class="points-view fp-page fp-ui">
    <section v-if="!loggedIn" class="card empty-state fp-card">
      <h1 v-if="!embedded" class="fp-page-title">积分流水</h1><p class="hint">请先 <RouterLink to="/login?redirect=/points">登录</RouterLink> 后查看积分余额与变动。</p>
    </section>
    <template v-else>
      <section class="balance-card">
        <div class="balance-info"><span class="balance-label">当前可用积分</span><div class="balance-value"><span class="currency-icon">💠</span><strong>{{ balance !== null ? balance.toLocaleString() : balanceLoading ? '读取中…' : '—' }}</strong></div><p v-if="balanceError" role="alert" class="err fp-state">{{ balanceError }} <button class="fp-control" type="button" @click="loadBalance">重试余额读取</button></p></div>
        <div class="balance-actions"><RouterLink to="/charge/point" class="action-btn primary">💰 充值积分</RouterLink><RouterLink to="/settings/point" class="action-btn">💸 积分转账</RouterLink><RouterLink to="/activity" class="action-btn">📅 活动签到</RouterLink></div>
      </section>
      <section class="card records-section fp-card">
        <header class="section-header"><div class="section-title"><h2 v-if="!embedded">积分流水</h2><span v-if="!loading && !error" class="record-count">共 {{ total.toLocaleString() }} 条</span></div><button type="button" class="refresh-points-btn" :disabled="loading || balanceLoading" :aria-busy="loading || balanceLoading" aria-label="刷新余额与流水" title="刷新余额与流水" @click="refresh"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg><span>{{ loading || balanceLoading ? '刷新中' : '刷新' }}</span></button></header>
        <FpLoading v-if="loading" class="loading-wrap" />
        <div v-else-if="error" role="alert" class="err fp-state">{{ error }} <button class="fp-control" type="button" @click="loadRecords">重试流水读取</button></div>
        <template v-else>
          <div class="records-list">
            <div v-if="!items.length" class="empty-list">{{ total ? '本页暂无记录，请返回已有页码' : '暂无记录' }}</div>
            <div v-for="(row, index) in items" :key="`${page}-${index}`" class="record-item" :class="direction(row)">
              <span class="record-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path v-if="direction(row) === 'income'" d="M7 7l10 10M7 17h10V7" /><path v-else-if="direction(row) === 'expense'" d="M7 17L17 7H7m10 0v10" /><path v-else d="M6 12h12" /></svg></span>
              <div class="record-main"><div class="record-desc" v-html="row.descriptionHtml" /><div class="record-meta"><span v-if="row.displayType" class="record-type">{{ row.displayType }}</span><time>{{ pointTime(row.time) }}</time></div></div>
              <div class="record-value"><div class="record-change"><span class="direction-label">{{ direction(row) === 'income' ? '收入' : direction(row) === 'expense' ? '支出' : '无变动' }}</span><strong>{{ pointChange(row) }}</strong></div><span class="record-balance">交易后余额：{{ row.balance.toLocaleString() }}</span></div>
            </div>
          </div>
          <footer v-if="total || page > 1" class="pager"><button type="button" class="pager-btn fp-control" :disabled="page <= 1" @click="page--">上一页</button><span class="page-num">{{ page }} / {{ pageCount }}</span><button type="button" class="pager-btn fp-control" :disabled="page >= Math.min(pageCount, 42949672)" @click="page++">下一页</button></footer>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.points-view { display:flex; flex-direction:column; gap:16px; }
.card { background:var(--fp-card); border:1px solid var(--fp-border); border-radius:var(--fp-panel-radius); }
.empty-state { text-align:center; padding:40px 20px; h1 { margin:0 0 14px; } }
.hint { color:var(--fp-muted); font-size:14px; }
.balance-card { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:20px; padding:24px; border:1px solid color-mix(in srgb,var(--fp-primary) 20%,var(--fp-border)); border-radius:var(--fp-panel-radius); background:linear-gradient(120deg,var(--fp-card),color-mix(in srgb,var(--fp-primary) 7%,var(--fp-card))); }
.balance-label { display:block; margin-bottom:9px; font-size:13px; color:var(--fp-muted); }
.balance-value { display:flex; align-items:center; gap:9px; color:var(--fp-title); strong { font-size:32px; font-weight:650; line-height:1.1; font-variant-numeric:tabular-nums; } }
.currency-icon { font-size:23px; }
.balance-actions { display:flex; gap:8px; flex-wrap:wrap; }
.action-btn { display:inline-flex; align-items:center; justify-content:center; gap:5px; padding:8px 12px; border:1px solid var(--fp-border); border-radius:8px; background:var(--fp-card); color:var(--fp-text); font-size:13px; text-decoration:none; &:hover { background:var(--fp-hover); text-decoration:underline; } &.primary { background:var(--fp-primary); border-color:var(--fp-primary); color:#fff; } }
.records-section { padding:0; overflow:hidden; }
.section-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:15px 20px; border-bottom:1px solid var(--fp-border); }
.section-title { display:flex; align-items:baseline; flex-wrap:wrap; gap:10px; h2 { margin:0; color:var(--fp-title); font-size:16px; font-weight:600; } }
.record-count { color:var(--fp-muted); font-size:12px; }
.refresh-points-btn { display:inline-flex; align-items:center; justify-content:center; gap:5px; min-height:30px; padding:5px 9px; border:1px solid transparent; border-radius:7px; background:transparent; color:var(--fp-muted); font:inherit; font-size:12px; line-height:1.5; cursor:pointer; transition:background-color .15s,color .15s; svg { width:15px; height:15px; } &:hover:not(:disabled) { background:var(--fp-hover); color:var(--fp-title); } &:focus-visible { outline:2px solid var(--fp-primary); outline-offset:2px; } &:disabled { cursor:default; opacity:.6; } &[aria-busy='true'] svg { animation:points-refresh 1s linear infinite; } }
@keyframes points-refresh { to { transform:rotate(360deg); } }
.loading-wrap,.empty-list,.err { padding:32px 20px; text-align:center; color:var(--fp-muted); }
.err { color:var(--fp-danger); }
.record-item { --flow-color:var(--fp-muted); display:flex; align-items:center; gap:12px; padding:12px 20px; border-bottom:1px solid var(--fp-border); transition:background-color .15s; &:last-child { border-bottom:0; } &:hover { background:var(--fp-hover); } &.income { --flow-color:var(--fp-income); } &.expense { --flow-color:var(--fp-danger); } }
.record-icon { display:grid; place-items:center; flex:none; width:30px; height:30px; border-radius:9px; color:var(--flow-color); background:color-mix(in srgb,var(--flow-color) 10%,transparent); svg { width:17px; height:17px; } }
.record-main { flex:1; min-width:0; }
.record-desc { font-size:14px; line-height:1.55; overflow-wrap:anywhere; color:var(--fp-text); :deep(p) { margin:0; } :deep(a) { color:var(--fp-link); text-decoration:none; &:hover { text-decoration:underline; } } }
.record-meta { display:flex; align-items:center; flex-wrap:wrap; column-gap:9px; row-gap:2px; margin-top:4px; color:var(--fp-muted); font-size:11px; line-height:1.5; }
.record-type { max-width:100%; overflow-wrap:anywhere; &::after { content:'·'; margin-left:9px; opacity:.6; } }
.record-value { flex:none; min-width:140px; text-align:right; }
.record-change { display:flex; align-items:center; justify-content:flex-end; gap:8px; color:var(--flow-color); strong { font-size:18px; font-weight:650; font-variant-numeric:tabular-nums; line-height:1.4; } }
.direction-label { font-size:10px; line-height:1.5; padding:1px 5px; border-radius:4px; background:color-mix(in srgb,var(--flow-color) 10%,transparent); }
.record-balance { display:block; margin-top:4px; color:var(--fp-muted); font-size:11px; line-height:1.5; font-variant-numeric:tabular-nums; }
.pager { display:flex; align-items:center; justify-content:center; gap:16px; padding:14px 20px; border-top:1px solid var(--fp-border); }
.pager-btn { padding:6px 12px; font-size:13px; }
.page-num { color:var(--fp-muted); font-size:12px; font-variant-numeric:tabular-nums; }
@media(max-width:640px) {
 .balance-card { padding:18px 16px; gap:16px; } .balance-actions { width:100%; } .action-btn { flex:1; padding:8px 6px; font-size:12px; } .balance-value strong { font-size:28px; }
 .section-header { padding:12px 14px; } .record-item { position:relative; display:grid; grid-template-columns:24px minmax(0,1fr); column-gap:9px; row-gap:6px; padding:11px 14px; }
 .record-icon { width:24px; height:24px; border-radius:7px; align-self:start; margin-top:1px; svg { width:15px; height:15px; } }
 .record-desc { font-size:13px; } .record-meta { font-size:10px; margin-top:3px; }
 .record-value { grid-column:2; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:3px 10px; min-width:0; text-align:left; }
 .record-change { justify-content:flex-start; gap:6px; strong { font-size:16px; } } .record-balance { margin:0; font-size:10px; }
}
@media(prefers-reduced-motion:reduce) { .record-item,.refresh-points-btn { transition:none; } .refresh-points-btn svg { animation:none!important; } }
</style>
