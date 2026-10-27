<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useV3InventoryStore } from '@/stores/v3Inventory'
import { usableCards, type CardCode } from '@/api/v3-inventory'
const store = useV3InventoryStore(), { account } = storeToRefs(useAuthStore())
const { items, loading, readError, error, followupError, busy, confirming, pending, receipt, revision } = storeToRefs(store)
const cardName = ref(''), paidName = ref(''), labels: Record<string, string> = { checkin1day: '单日免签卡', checkin2days: '两日免签卡', patchCheckinCard: '补签卡', nameCard: '改名卡', metalTicket: '周年勋章领取券', sysCheckinRemain: '剩余免签天数', patchStart: '补签记录起始日' }
const blocked = computed(() => busy.value || confirming.value || !!pending.value)
watch(revision, () => { cardName.value = paidName.value = '' }, { flush: 'sync' })
watch(pending, value => { if (value?.input.kind === 'nameCard') cardName.value = value.input.userName; if (value?.input.kind === 'points') paidName.value = value.input.userName }, { immediate: true })
const hasItems = computed(() => !!items.value?.some(item => item.count !== 0))
function available(code: string): code is CardCode { return usableCards.includes(code as CardCode) }
function useCard(code: CardCode) { void store.use(code === 'nameCard' ? { kind: code, userName: cardName.value } : { kind: code }) }
onMounted(() => { void store.load() })
</script>
<template>
  <section class="owner-inventory" aria-label="本人背包和用户名">
    <h2>你的背包</h2><button type="button" :disabled="loading || busy" @click="store.load">重新读取背包</button>
    <p v-if="loading">正在读取背包…</p><p v-else-if="readError" role="alert" class="error">{{ readError }}</p>
    <template v-else-if="items">
      <p v-if="!hasItems">背包暂无物品或生效中的免签天数。</p>
      <ul v-else><li v-for="item in items.filter(row => row.count !== 0)" :key="item.code"><span>{{ labels[item.code] || item.code }}：{{ item.count }}</span><button v-if="available(item.code) && item.count > 0 && item.code !== 'nameCard'" type="button" :disabled="blocked" @click="useCard(item.code)">使用{{ labels[item.code] }}</button></li></ul>
      <form v-if="items.some(item => item.code === 'nameCard' && item.count > 0)" @submit.prevent="useCard('nameCard')"><fieldset :disabled="blocked"><label>改名卡新用户名<input v-model="cardName" aria-label="改名卡新用户名" maxlength="64" autocomplete="off" /></label><button type="submit">使用一张改名卡</button></fieldset></form>
    </template>
    <p class="hint">免签卡增加后续系统签到使用的剩余天数；补签须满足当天签到等条件，最终以服务端校验为准。周年勋章领取券仅展示。</p>
    <h2>使用积分改名</h2><p>当前用户名：{{ account?.userName || '—' }}</p><p class="hint">每次按当前改名费用扣费（目前1000积分）；不能使用当前名称、保留名称或已用名称。</p>
    <form @submit.prevent="store.use({ kind: 'points', userName: paidName })"><fieldset :disabled="blocked"><label>积分改名新用户名<input v-model="paidName" aria-label="积分改名新用户名" maxlength="64" autocomplete="off" /></label><button type="submit">核对并用积分改名</button></fieldset></form>
    <p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="pending" class="hint">操作结果尚未确认，原请求保留在当前页面会话中。刷新或退出会清除本地恢复信息，请先核对当前背包、用户名及流水。</p><button v-if="pending" type="button" :disabled="busy" @click="store.retry">重试未确认操作</button>
    <section v-if="receipt" class="receipt" aria-label="本次已确认背包或改名回执"><h3>本次已确认操作</h3>
      <p v-if="receipt.kind === 'points'">积分改名：{{ receipt.userName }}，实际扣费 {{ receipt.paidPoints }} 积分。</p>
      <p v-else-if="receipt.kind === 'nameCard'">已使用一张改名卡，本次用户名：{{ receipt.userName }}。</p>
      <p v-else-if="receipt.kind === 'patchCheckinCard'">补签成功，本次连续 {{ receipt.streak }} 天，{{ receipt.streakStart }} 至 {{ receipt.streakEnd }}；最长 {{ receipt.longestStreak }} 天。</p>
      <p v-else>已使用{{ labels[receipt.kind] }}，本次剩余免签 {{ receipt.remainingDays }} 天。</p>
      <p class="hint">以上为本次操作结果；当前用户名和背包重新读取，可能因后续操作而不同。</p>
    </section>
    <p v-if="followupError" role="alert" class="error">{{ followupError }}</p>
  </section>
</template>
<style scoped lang="scss">
.owner-inventory { margin: 16px 0; } fieldset { margin: 0; padding: 0; border: 0; } label { display: grid; gap: 6px; margin: 12px 0; } input { padding: 9px 12px; max-width: 100%; box-sizing: border-box; color: var(--fp-text); background: var(--fp-bg); border: 1px solid var(--fp-border); border-radius: 8px; } button { margin: 6px 8px 6px 0; padding: 8px 12px; color: var(--fp-text); background: transparent; border: 1px solid var(--fp-border); border-radius: 8px; cursor: pointer; } button:disabled { opacity: .5; cursor: default; } li { margin: 10px 0; overflow-wrap: anywhere; } .hint { color: var(--fp-muted); font-size: 13px; } .error { color: #c34a36; } .receipt { padding-top: 12px; margin-top: 18px; border-top: 1px solid var(--fp-border); } h2 { font-size: 18px; }
</style>
