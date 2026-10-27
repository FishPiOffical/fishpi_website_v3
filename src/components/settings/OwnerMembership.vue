<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ApiError } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { fpConfirm } from '@/composables/useDialog'
import { invalidateVipName, parseVipNameConfig, vipNameClass, vipNameStyle } from '@/composables/useVipNickname'
import { profileOperationKey } from '@/api/v3-profile'
import { fetchV3Membership, fetchV3MembershipLevels, membershipDisplayFields, membershipEffects, membershipColor, membershipOpening, openV3Membership, saveV3MembershipDisplay,
  type MembershipState, type MembershipLevel, type MembershipDisplay, type MembershipOpening } from '@/api/v3-membership'
const auth = useAuthStore(), { accessToken, account } = storeToRefs(auth)
const mounted = ref(false), active = computed(() => mounted.value && !!accessToken.value)
const levels = ref<MembershipLevel[]>([]), state = ref<MembershipState | null>(null), levelsReady = ref(false)
const levelsLoading = ref(false), stateLoading = ref(false), levelsError = ref(''), stateError = ref('')
const busy = ref(false), confirming = ref(false), error = ref(''), message = ref(''), coupon = ref('')
const draft = ref<{ bold: boolean | ''; underline: boolean | ''; color: string }>({ bold: '', underline: '', color: '' })
type Intent = { key: string } & ({ kind: 'open'; input: MembershipOpening } | { kind: 'config'; changes: MembershipDisplay })
const pending = ref<Intent | null>(null)
let generation = 0, stateSequence = 0, levelsSequence = 0
const support = computed(() => {
  if (!levelsReady.value || !state.value) return { fields: [] as (keyof MembershipDisplay)[], error: '' }
  try { return { fields: membershipDisplayFields(levels.value, state.value), error: '' } }
  catch (failure) { return { fields: [] as (keyof MembershipDisplay)[], error: failure instanceof Error ? failure.message : '展示定义不可用' } }
})
const advanced = computed(() => state.value?.levelCode === 'VIP4_YEAR' || state.value?.levelCode === 'VIP4_MONTH')
const disabled = computed(() => busy.value || confirming.value || !!pending.value || stateLoading.value || levelsLoading.value)
const preview = computed(() => parseVipNameConfig(!!state.value?.active, { ...(draft.value.bold !== '' ? { bold: draft.value.bold } : {}), ...(draft.value.underline !== '' ? { underline: draft.value.underline } : {}), ...(membershipColor(draft.value.color) ? { color: draft.value.color } : {}) }))
const benefitNames = { bold: '昵称加粗', underline: '昵称下划线', color: '昵称颜色', autoCheckin: '自动签到', checkinCard: '签到卡数量', metal: '勋章权益', jointVip: '联合会员权益' }
function benefit(value: unknown) { return typeof value === 'boolean' ? value ? '是' : '否' : String(value) }
function date(value: number) { if (!value) return '永久'; const d = new Date(value); return Number.isNaN(d.getTime()) ? '时间异常' : d.toLocaleString() }
function reset() {
  generation++; stateSequence++; levelsSequence++; levels.value = []; state.value = null; levelsReady.value = false
  draft.value = { bold: '', underline: '', color: '' }; coupon.value = ''; pending.value = null
  levelsError.value = stateError.value = error.value = message.value = ''; levelsLoading.value = stateLoading.value = busy.value = confirming.value = false
}
function guard() { const token = accessToken.value, current = generation; return () => mounted.value && !!token && token === accessToken.value && current === generation }
async function loadState() {
  if (!accessToken.value) return
  const valid = guard(), sequence = ++stateSequence
  state.value = null; stateLoading.value = true; stateError.value = ''
  try { const value = await fetchV3Membership(); if (valid() && sequence === stateSequence) { state.value = value; draft.value = { bold: value.config.bold ?? '', underline: value.config.underline ?? '', color: value.config.color ?? '' } } }
  catch (failure) { if (valid() && sequence === stateSequence) stateError.value = failure instanceof Error ? failure.message : '会员状态读取失败' }
  finally { if (valid() && sequence === stateSequence) stateLoading.value = false }
}
async function loadLevels() {
  if (!accessToken.value) return
  const valid = guard(), sequence = ++levelsSequence
  levels.value = []; levelsReady.value = false; levelsLoading.value = true; levelsError.value = ''
  try { const value = await fetchV3MembershipLevels(); if (valid() && sequence === levelsSequence) { levels.value = value; levelsReady.value = true } }
  catch (failure) { if (valid() && sequence === levelsSequence) levelsError.value = failure instanceof Error ? failure.message : '会员档位读取失败' }
  finally { if (valid() && sequence === levelsSequence) levelsLoading.value = false }
}
async function execute(intent: Intent) {
  if (!accessToken.value || busy.value) return
  const valid = guard()
  pending.value = intent; busy.value = true; error.value = message.value = ''
  try {
    if (intent.kind === 'open') {
      const result = await openV3Membership(intent.input, intent.key)
      if (valid()) message.value = `开通结果已确认，实际扣除 ${result.paidPoints} 积分（${result.levelCode}）`
    } else {
      await saveV3MembershipDisplay(intent.changes, intent.key)
      if (valid()) { message.value = '会员展示设置已保存'; invalidateVipName(account.value?.oId, account.value?.userName) }
    }
    if (valid()) {
      pending.value = null
      void auth.reloadAccount().catch(() => {})
      await loadState()
    }
  } catch (failure) {
    if (valid()) { error.value = failure instanceof Error ? failure.message : '会员操作失败'; if (failure instanceof ApiError && failure.status >= 400 && failure.status < 500) pending.value = null }
  } finally { if (valid()) busy.value = false }
}
async function buy(level: MembershipLevel) {
  if (disabled.value || !state.value || state.value.active || !levelsReady.value || !accessToken.value) return
  const valid = guard()
  error.value = message.value = ''
  let input: MembershipOpening
  try { input = membershipOpening(level.id, coupon.value) } catch (failure) { error.value = failure instanceof Error ? failure.message : '优惠券格式不合法'; return }
  confirming.value = true
  try {
    const accepted = await fpConfirm({ title: '确认积分开通会员', message: `开通「${level.name}」${level.durationType}，${level.durationValue}天，当前显示标价 ${level.price} 积分。${input.couponCode ? '已填写优惠券；' : ''}服务器按提交时档位价格与优惠券校验结果结算，失败不扣积分。是否继续？`, confirmText: '确认开通' })
    if (accepted && valid()) await execute({ kind: 'open', input, key: profileOperationKey() })
  } finally { if (valid()) confirming.value = false }
}
async function save() {
  if (disabled.value || !state.value?.active || !support.value.fields.length) return
  const changes: MembershipDisplay = {}
  error.value = message.value = ''
  for (const key of support.value.fields) {
    const value = draft.value[key]
    if (value === state.value.config[key] || value === '' && state.value.config[key] === undefined) continue
    if (key === 'color') {
      if (typeof value !== 'string' || !membershipColor(value) || !advanced.value && !/^#[0-9a-fA-F]{6}$/.test(value)) { error.value = '颜色须为#RRGGBB；仅VIP4可使用预设效果'; return }
      changes.color = value
    } else {
      if (typeof value !== 'boolean') { error.value = '请选择要保存的布尔值'; return }
      changes[key] = value
    }
  }
  if (!Object.keys(changes).length) { message.value = '没有需要保存的更改'; return }
  await execute({ kind: 'config', changes, key: profileOperationKey() })
}
function retry() { if (pending.value && !busy.value) void execute(pending.value) }
onMounted(() => { mounted.value = true; void loadLevels(); void loadState() })
watch(accessToken, () => { reset(); if (mounted.value) { void loadLevels(); void loadState() } }, { flush: 'sync' })
onBeforeUnmount(() => { mounted.value = false; reset() })
</script>

<template>
  <div class="membership">
    <h1>摸鱼派会员</h1>
    <p v-if="!active"><RouterLink :to="{ path: '/login', query: { redirect: '/vips' } }">登录</RouterLink>后查看会员档位与本人状态。</p>
    <template v-else>
      <section class="state">
        <h2>本人会员状态</h2><p v-if="stateLoading" role="status">正在读取会员状态…</p><p v-if="stateError" class="error" role="alert">{{ stateError }}</p>
        <template v-if="state"><p>{{ state.active ? `当前有效会员：${state.levelCode}` : '当前没有有效会员' }}</p><p v-if="state.active">到期：{{ date(state.expiresAt) }}</p></template>
        <button type="button" :disabled="disabled" @click="loadState">重新读取会员状态</button>
      </section>
      <p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="message" role="status">{{ message }}</p>
      <p v-if="pending && !busy">操作结果尚未确认，重试将恢复同一次操作，不重新选择档位或优惠券。</p>
      <button v-if="pending" type="button" :disabled="busy" @click="retry">重试未确认的会员操作</button>
      <section v-if="state?.active" class="display">
        <h2>昵称展示</h2><p v-if="support.error" class="error" role="alert">{{ support.error }}</p>
        <p v-if="levelsReady && !support.error && !support.fields.length">当前档位没有可设置的昵称展示字段。</p>
        <form v-if="support.fields.length" @submit.prevent="save">
          <fieldset :disabled="disabled">
            <label v-if="support.fields.includes('bold')">昵称加粗<select v-model="draft.bold" aria-label="昵称加粗"><option value="" disabled>尚未设置</option><option :value="true">加粗</option><option :value="false">不加粗</option></select></label>
            <label v-if="support.fields.includes('underline')">昵称下划线<select v-model="draft.underline" aria-label="昵称下划线"><option value="" disabled>尚未设置</option><option :value="true">显示下划线</option><option :value="false">不显示下划线</option></select></label>
            <template v-if="support.fields.includes('color')"><label>昵称颜色<input v-model="draft.color" aria-label="昵称颜色" maxlength="32" placeholder="#RRGGBB" /></label><div v-if="advanced" class="effects"><button v-for="effect in membershipEffects" :key="effect" type="button" :aria-pressed="draft.color === effect" @click="draft.color = effect">{{ effect }}</button></div></template>
            <p>预览：<span :class="vipNameClass(preview)" :style="vipNameStyle(preview)">{{ account?.userNickname || account?.userName || '我的昵称' }}</span></p>
            <button type="submit">保存会员展示</button>
          </fieldset>
        </form>
        <h3>本人已知权益（只读）</h3><ul><li v-for="(value, key) in state.config" :key="key">{{ benefitNames[key] }}：{{ benefit(value) }}</li></ul>
      </section>
      <section class="plans">
        <h2>会员档位</h2><p v-if="levelsLoading" role="status">正在读取会员档位…</p><p v-if="levelsError" role="alert" class="error">{{ levelsError }}</p>
        <button type="button" :disabled="disabled" @click="loadLevels">重新读取会员档位</button>
        <label v-if="levelsReady" class="coupon">优惠券（可选）<input v-model="coupon" aria-label="会员优惠券" maxlength="128" autocomplete="off" :disabled="disabled || !state || state.active" placeholder="不使用时留空" /></label>
        <p class="hint">仅未开通或已到期且符合资格的账号可开通，有效或永久会员不能重复购买。期限从服务器次日零点起加所列自然日，配置与礼包由服务端初始化；优惠券无效时拒绝开通。</p>
        <p v-if="levelsReady && !levels.length">暂无可用会员档位。</p>
        <div class="plan-grid"><article v-for="level in levels" :key="level.id" class="plan"><h3>{{ level.name }}</h3><p>{{ level.code }} · {{ level.durationType }} · {{ level.durationValue }}天</p><p class="price">{{ level.price.toLocaleString() }} 积分</p><ul><li v-for="(value, key) in level.benefits" :key="key">{{ benefitNames[key] }}{{ ['bold','underline','color'].includes(key) ? '默认值' : '' }}：{{ benefit(value) }}</li></ul><button type="button" :disabled="disabled || !state || state.active" @click="buy(level)">{{ state?.active ? '已有有效会员' : `开通${level.name}（${level.durationType}）` }}</button></article></div>
      </section>
      <section class="questions">
        <h2>开通说明</h2>
        <details><summary>有效会员可以续购或升级吗？</summary><p>当前有效或永久会员不能重复开通。已到期账号可按届时档位与资格重新申请。</p></details>
        <details><summary>优惠券无效或余额不足会怎样？</summary><p>开通会被拒绝，不扣积分。使用优惠券后的实际费用以服务端结算结果为准。</p></details>
        <details><summary>网络中断后如何确认结果？</summary><p>留在本页使用“重试未确认的会员操作”恢复同一次请求。若已离开本页，请重新读取会员状态、积分流水和背包核实，不要把读取失败当作未开通。</p></details>
        <details><summary>年卡礼包有哪些？</summary><p>VIP1_YEAR、VIP2_YEAR、VIP3_YEAR分别赠送20、50、120张免签卡，VIP4_YEAR增加366天免签额度；其他档位不含这组礼包。礼包与扣费一起提交，背包数量达到上限时保持上限。</p></details>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.membership { max-width: 1200px; margin: 0 auto; padding: 24px 16px 60px; } h1 { font-size: 26px; } h2 { font-size: 20px; } h3 { font-size: 17px; } section { margin: 24px 0; padding-top: 12px; border-top: 1px solid var(--fp-border); }
fieldset { border: 0; padding: 0; margin: 0; } label { display: grid; gap: 6px; margin: 12px 0; max-width: 440px; } input,select { padding: 9px 12px; border: 1px solid var(--fp-border); border-radius: 8px; color: var(--fp-text); background: var(--fp-bg); max-width: 100%; box-sizing: border-box; }
button { border: 1px solid var(--fp-border); background: transparent; color: var(--fp-text); border-radius: 8px; padding: 8px 14px; margin: 6px 8px 6px 0; cursor: pointer; } button:disabled { opacity: .5; cursor: default; } .effects { display: flex; flex-wrap: wrap; } .hint { color: var(--fp-muted); font-size: 13px; } .error { color: #c34a36; }
.plan-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(245px,1fr)); gap: 20px; } .plan { padding: 18px; border: 1px solid var(--fp-border); border-radius: 12px; background: var(--fp-card); } .plan h3 { margin-top: 0; } .price { font-size: 23px; font-weight: 600; } li { margin: 8px 0; overflow-wrap: anywhere; }
@media(max-width: 640px) { .membership { padding: 16px 12px 40px; } .plan-grid { grid-template-columns: 1fr; } }
</style>
