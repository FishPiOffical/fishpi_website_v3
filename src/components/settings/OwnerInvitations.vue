<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ApiError } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useV3FinanceStore } from '@/stores/v3Finance'
import { fetchV3InvitationStatus, invitationInput, type InvitationStatus } from '@/api/v3-finance'
const { account } = storeToRefs(useAuthStore()), finance = useV3FinanceStore()
const { invitations, invitationBusy, invitationConfirming, invitationPending, invitationError, refreshError, revision } = storeToRefs(finance)
const query = ref(''), queryBusy = ref(false), queryError = ref(''), status = ref<InvitationStatus | null>(null), queried = ref(''), copyMessage = ref('')
let mounted = true, sequence = 0
const inviteLink = computed(() => typeof window === 'undefined' || !account.value?.userName ? '' : `${window.location.origin}/register?r=${encodeURIComponent(account.value.userName)}`)
const statuses = { unused: '未使用（不保证当前可注册）', used: '已使用', stopped: '已停用' }
function date(value: number) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '时间异常' : d.toLocaleString() }
function clear() { sequence++; query.value = queried.value = queryError.value = copyMessage.value = ''; status.value = null; queryBusy.value = false }
watch(revision, clear, { flush: 'sync' })
async function lookup() {
  if (queryBusy.value) return
  const valid = finance.capture(), current = ++sequence
  if (!valid()) return
  queryError.value = ''; status.value = null; queried.value = ''
  let code: string
  try { code = invitationInput(query.value) } catch (error) { queryError.value = error instanceof Error ? error.message : '邀请码不合法'; return }
  queryBusy.value = true
  try { const value = await fetchV3InvitationStatus(code); if (mounted && valid() && current === sequence) { status.value = value; queried.value = code } }
  catch (error) { if (mounted && valid() && current === sequence) queryError.value = error instanceof ApiError && error.status === 404 ? '未找到该邀请码' : error instanceof Error ? error.message : '查询失败' }
  finally { if (mounted && valid() && current === sequence) queryBusy.value = false }
}
async function copy(value: string) {
  const valid = finance.capture(); if (!valid()) return; copyMessage.value = ''
  try { await navigator.clipboard.writeText(value); if (mounted && valid()) copyMessage.value = '已复制' }
  catch { if (mounted && valid()) copyMessage.value = '复制失败，请手动选择文本' }
}
onBeforeUnmount(() => { mounted = false; clear() })
</script>

<template>
  <div class="owner-invitations">
    <h2>邀请链接</h2><label>分享给好友注册<input :value="inviteLink" aria-label="本人邀请链接" readonly @focus="($event.target as HTMLInputElement).select()" /></label>
    <button type="button" :disabled="!inviteLink" @click="copy(inviteLink)">复制邀请链接</button><p class="hint">是否能使用邀请链接注册，以注册页面校验为准。</p>
    <h2>购买邀请码</h2><p>仅当前邀请注册模式可购买，每枚100积分；余额不足不生成邀请码。</p>
    <button type="button" :disabled="invitationBusy || invitationConfirming || !!invitationPending" @click="finance.purchaseInvitation">{{ invitationBusy ? '正在购买…' : '核对并购买邀请码' }}</button>
    <p v-if="invitationError" role="alert" class="error">{{ invitationError }}</p><p v-if="invitationPending && !invitationBusy" class="hint">购买结果尚未确认，重试会恢复原邀请码，不另买一枚。刷新页面或退出会清除本地恢复信息，请先确认购买结果。</p>
    <button v-if="invitationPending" type="button" :disabled="invitationBusy" @click="finance.retryInvitation">重试未确认邀请码购买</button>
    <section v-if="invitations.length" class="receipts" aria-label="本次会话购买的邀请码">
      <h3>本次登录会话已确认的购买</h3><p class="hint">邀请码只保留在当前页面会话内存中，请妥善保存；回执不保证邀请码仍可注册。</p>
      <ul><li v-for="item in invitations" :key="item.code"><code>{{ item.code }}</code><span>到期：{{ date(item.expiresAt) }} · 实付 {{ item.paidPoints }} 积分</span><button type="button" @click="copy(item.code)">复制{{ item.code }}</button></li></ul>
    </section>
    <p v-if="copyMessage" role="status">{{ copyMessage }}</p><p v-if="refreshError" role="alert" class="error">{{ refreshError }}</p>
    <h2>查询已知邀请码状态</h2>
    <form @submit.prevent="lookup"><label>邀请码<input v-model="query" aria-label="查询邀请码" maxlength="128" autocomplete="off" /></label><button type="submit" :disabled="queryBusy">查询邀请码状态</button></form>
    <p v-if="queryError" role="alert" class="error">{{ queryError }}</p><p v-if="status" role="status">{{ queried }}：{{ statuses[status] }}</p>
  </div>
</template>

<style scoped lang="scss">
h2 { margin-top: 24px; font-size: 18px; } h3 { font-size: 16px; } label { display: grid; gap: 6px; margin: 12px 0; } input { padding: 9px 12px; color: var(--fp-text); background: var(--fp-bg); border: 1px solid var(--fp-border); border-radius: 8px; max-width: 100%; box-sizing: border-box; }
button { padding: 8px 12px; margin: 6px 8px 6px 0; border: 1px solid var(--fp-border); border-radius: 8px; color: var(--fp-text); background: transparent; cursor: pointer; } button:disabled { opacity: .5; cursor: default; } .hint { font-size: 13px; color: var(--fp-muted); } .error { color: #c34a36; } .receipts { border-top: 1px solid var(--fp-border); padding-top: 12px; margin: 18px 0; } ul { padding-left: 20px; } li { margin: 14px 0; overflow-wrap: anywhere; } li > span { display: block; }
</style>
