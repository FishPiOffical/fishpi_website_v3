<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchMembershipDetail,
  fetchMembershipLevels,
  openMembership,
  type MembershipLevel,
  type MembershipStatus,
} from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAppearanceStore } from '@/stores/appearance'
import { useAuthStore } from '@/stores/auth'

usePageSeo(() => ({
  title: '开通 VIP',
  path: '/vips',
  robots: 'noindex',
}))

const route = useRoute()
const auth = useAuthStore()
const appearance = useAppearanceStore()
const { apiKey, account, isLoggedIn, isVip } = storeToRefs(auth)

const levels = ref<MembershipLevel[]>([])
const status = ref<MembershipStatus | null>(null)
const loading = ref(true)
const busyId = ref('')
const coupon = ref('')
const err = ref('')
const ok = ref('')

const points = computed(() => Number(account.value?.userPoint || 0))

const benefitLabels: Record<string, string> = {
  bold: '昵称加粗',
  underline: '昵称下划线',
  color: '彩色昵称',
  checkinCard: '免签卡',
  metal: '勋章权益',
  jointVip: '联合会员',
  autoCheckin: '自动签到',
}

function formatBenefits(raw?: string) {
  if (!raw) return []
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>
    return Object.entries(obj)
      .filter(([, v]) => v !== false && v !== 0 && v != null && v !== '')
      .map(([k, v]) => {
        const label = benefitLabels[k] || k
        if (v === true) return label
        return `${label} ×${v}`
      })
  } catch {
    return [raw]
  }
}

function expiresText(ts?: number) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return String(ts)
  }
}

async function load() {
  loading.value = true
  err.value = ''
  try {
    levels.value = await fetchMembershipLevels()
    if (account.value?.oId) {
      status.value = await fetchMembershipDetail(account.value.oId)
    } else {
      status.value = null
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function buy(level: MembershipLevel) {
  ok.value = ''
  err.value = ''
  if (!apiKey.value) {
    err.value = '请先登录'
    return
  }
  if (isVip.value) {
    err.value = '当前已是会员，请等待周期结束后再开通'
    return
  }
  if (points.value < level.price) {
    err.value = `积分不足（需要 ${level.price}，当前 ${points.value}）。可先去捐助兑换积分。`
    return
  }
  if (!window.confirm(`确认花费 ${level.price} 积分开通「${level.lvName}」${level.durationType}？`)) return
  busyId.value = level.oId
  try {
    await openMembership(apiKey.value, level.oId, coupon.value.trim())
    ok.value = '开通成功'
    await auth.reloadAccount()
    await auth.refreshMembership()
    appearance.enforceVip()
    await load()
  } catch (e) {
    err.value = e instanceof Error ? e.message : '开通失败'
  } finally {
    busyId.value = ''
  }
}

onMounted(async () => {
  if (apiKey.value && !account.value) await auth.restore()
  await load()
})
</script>

<template>
  <section class="card">
    <h1>摸鱼派 VIP</h1>
    <p class="hint">用积分开通会员；价格与权益来自 <code>GET /api/membership/levels</code>。</p>

    <p v-if="!isLoggedIn" class="hint">
      <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>
      后查看状态并开通。
    </p>
    <template v-else>
      <p class="status">
        积分余额 <b>{{ points.toLocaleString() }}</b>
        ·
        <template v-if="isVip && status">
          会员有效至 <b>{{ expiresText(status.expiresAt) }}</b>
          <span v-if="status.lvCode">（{{ status.lvCode }}）</span>
        </template>
        <template v-else>当前不是会员</template>
      </p>
      <p class="links">
        <RouterLink to="/charge/point">捐助换积分</RouterLink>
        <RouterLink to="/settings/system">个性化（VIP 对话框/头像框）</RouterLink>
        <RouterLink to="/points">积分流水</RouterLink>
      </p>
    </template>

    <label v-if="isLoggedIn" class="coupon">
      优惠券码（可选）
      <input v-model="coupon" maxlength="64" placeholder="无效券会加价，请谨慎" />
    </label>

    <p v-if="loading" class="hint">加载中…</p>
    <p v-if="err" class="err">{{ err }}</p>
    <p v-if="ok" class="ok">{{ ok }}</p>

    <ul v-if="!loading" class="levels">
      <li v-for="lv in levels" :key="lv.oId">
        <header>
          <h2>{{ lv.lvName }}</h2>
          <span class="price">{{ lv.price.toLocaleString() }} 积分</span>
        </header>
        <p class="meta">{{ lv.durationType }} · {{ lv.durationValue }} 天 · 已开通 {{ lv.openedMemberCount ?? 0 }}</p>
        <ul class="benefits">
          <li v-for="(b, i) in formatBenefits(lv.benefits)" :key="i">{{ b }}</li>
          <li v-if="!formatBenefits(lv.benefits).length" class="muted">权益见等级配置</li>
        </ul>
        <button
          type="button"
          class="primary"
          :disabled="!isLoggedIn || isVip || !!busyId"
          @click="buy(lv)"
        >
          {{ busyId === lv.oId ? '开通中…' : isVip ? '已是会员' : '开通' }}
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.card {
  max-width: 820px;
  margin: 0 auto;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 20px 22px;
}
h1 {
  margin: 0 0 8px;
  font-size: 20px;
  color: var(--fp-title);
}
.hint,
.status,
.meta {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--fp-muted);
  line-height: 1.5;
}
.status b {
  color: var(--fp-text);
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0 0 14px;
  font-size: 13px;
}
.links a {
  color: var(--fp-link);
}
.coupon {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  font-size: 13px;
  color: var(--fp-muted);
}
.coupon input {
  max-width: 320px;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 6px;
  padding: 8px 10px;
}
.levels {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.levels > li {
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--fp-bg);
}
header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: baseline;
}
h2 {
  margin: 0;
  font-size: 16px;
  color: var(--fp-title);
}
.price {
  font-size: 13px;
  color: var(--fp-primary);
  font-weight: 600;
  white-space: nowrap;
}
.benefits {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--fp-text);
  flex: 1;
}
.muted {
  color: var(--fp-muted);
  list-style: none;
  margin-left: -18px;
}
.primary {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
}
.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.err {
  color: #e07a5f;
  font-size: 13px;
}
.ok {
  color: var(--fp-green, #3d8b6e);
  font-size: 13px;
}
</style>
