<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLegacyMembershipStore } from '@/stores/legacyMembership'
import { legacyBenefitLabels, type LegacyMemberLevel, type LegacyBenefits, type LegacyMemberCommand } from '@/api/legacy/membership'
import { membershipEffects } from '@/api/v3-membership'
import { getAuthContextVersion } from '@/api/http'
import { fpConfirm } from '@/composables/useDialog'
const auth = useAuthStore(), store = useLegacyMembershipStore(), mounted = ref(false), confirming = ref(false), coupon = ref(''), bold = ref<boolean | ''>(''), underline = ref<boolean | ''>(''), color = ref(''), error = ref('')
let confirmation: AbortController | null = null
const identity = () => JSON.stringify([getAuthContextVersion(), auth.apiKey, auth.account?.oId]), active = computed(() => mounted.value && !!auth.apiKey && !!auth.account?.oId), blocked = computed(() => store.busy || !!store.pending || confirming.value || store.stateLoading || store.levelsLoading)
const template = computed(() => { const matches = store.levels?.filter(row => row.code === store.state?.code) || []; return matches.length && matches.every(row => JSON.stringify(row.benefits) === JSON.stringify(matches[0]!.benefits) && !row.unsupported) ? matches[0]! : null })
const editable = computed(() => { const current = store.state, level = template.value; if (!current?.active || current.unsupported || !level) return false; const keys = Object.keys(level.benefits); return keys.length === Object.keys(current.config).length && keys.every(key => Object.hasOwn(current.config, key) && typeof current.config[key] === typeof level.benefits[key]) })
function label(key: string) { return legacyBenefitLabels[key as keyof typeof legacyBenefitLabels] || key }
function cancel() { confirmation?.abort(); confirmation = null; confirming.value = false }
watch(() => store.state, value => { bold.value = typeof value?.config.bold === 'boolean' ? value.config.bold : ''; underline.value = typeof value?.config.underline === 'boolean' ? value.config.underline : ''; color.value = typeof value?.config.color === 'string' ? value.config.color : '' })
async function execute(input: LegacyMemberCommand, message: string) {
  if (blocked.value || !active.value) return
  const owner = identity(), controller = new AbortController(); confirmation = controller; confirming.value = true
  try { if (await fpConfirm({ title: '确认旧会员操作', message, confirmText: '确认提交', signal: controller.signal }) && !controller.signal.aborted && owner === identity() && mounted.value && !store.pending && !store.busy) await store.execute(input) }
  finally { if (confirmation === controller) { confirmation = null; confirming.value = false } }
}
function buy(level: LegacyMemberLevel) {
  if (!store.state || store.state.active || !store.levels?.includes(level)) return
  error.value = ''
  const raw = coupon.value
  if (raw.length > 128 || /[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/.test(raw)) { error.value = '优惠券格式不合法'; return }
  void execute({ kind: 'open', levelId: level.id, coupon: raw.trim() }, `开通 ${level.name}（${level.durationType}），目录价格 ${level.price} 积分，周期参数 ${level.durationValue}。${raw.trim() ? '已填写优惠券；旧服务对无效券可能按原价1.2倍收费，并非拒绝交易。' : '本次未填写优惠券。'}实际费用、资格和期限由服务端结算，成功响应不作为当前状态；旧接口不能幂等重试。是否继续？`)
}
function save() {
  if (!editable.value || !store.state || !template.value) return
  const config: LegacyBenefits = { ...store.state.config }
  if ('bold' in config && bold.value !== '') config.bold = bold.value
  if ('underline' in config && underline.value !== '') config.underline = underline.value
  if ('color' in config) {
    if (!/^#[a-f0-9]{6}$/i.test(color.value) && !(store.state.code?.includes('VIP4') && (membershipEffects as readonly string[]).includes(color.value))) { error.value = '颜色须为六位Hex；VIP4可选既有渐变效果'; return }
    config.color = color.value
  }
  error.value = ''
  void execute({ kind: 'config', config }, '保存完整会员配置，仅修改当前编辑的昵称展示字段，其他已读取配置原样保留。是否继续？')
}
watch(identity, () => { cancel(); coupon.value = ''; error.value = ''; if (mounted.value) { void store.loadState(); void store.loadLevels() } }, { flush: 'sync' })
onMounted(() => { mounted.value = true; void store.loadState(); void store.loadLevels() })
onScopeDispose(() => { mounted.value = false; cancel(); coupon.value = '' })
</script>
<template>
  <div class="membership"><h1>摸鱼派 VIP</h1><p v-if="!active"><RouterLink to="/login?redirect=/vips">登录后查看或开通会员</RouterLink></p><template v-else>
    <section><h2>当前会员</h2><p v-if="store.stateLoading" role="status">正在读取会员状态…</p><p v-if="store.stateError" role="alert" class="error">{{ store.stateError }}</p><template v-if="store.state"><p>{{ store.state.active ? `当前档位：${store.state.code}` : '当前没有有效会员' }}</p><p v-if="store.state.active">到期：{{ store.state.expiresAt === 0 ? '永久' : new Date(store.state.expiresAt!).toLocaleString() }}</p><ul><li v-for="(value,key) in store.state.config" :key="key">{{ label(String(key)) }}：{{ value }}</li></ul><p v-if="store.state.unsupported" class="hint">包含未支持的配置项，暂不能安全编辑完整配置。</p></template><button type="button" :disabled="store.stateLoading || store.busy" @click="store.loadState">重新读取会员状态</button></section>
    <section v-if="store.state?.active"><h2>昵称展示</h2><p v-if="!editable" class="hint">当前完整配置与档位模板不匹配，暂不能编辑；请勿用模板默认值覆盖现有权益。</p><form v-else @submit.prevent="save"><fieldset :disabled="blocked"><label v-if="Object.hasOwn(store.state.config,'bold')">昵称加粗<select v-model="bold" aria-label="昵称加粗"><option :value="true">开启</option><option :value="false">关闭</option></select></label><label v-if="Object.hasOwn(store.state.config,'underline')">昵称下划线<select v-model="underline" aria-label="昵称下划线"><option :value="true">开启</option><option :value="false">关闭</option></select></label><label v-if="Object.hasOwn(store.state.config,'color')">昵称颜色<input v-model="color" aria-label="昵称颜色" maxlength="32" /></label><p class="hint">其他权益配置保持当前读取值；仅可修改本页昵称展示字段。</p><button type="submit">保存会员展示</button></fieldset></form></section>
    <section><h2>会员档位</h2><p v-if="store.levelsLoading" role="status">正在读取会员档位…</p><p v-if="store.levelsError" role="alert" class="error">{{ store.levelsError }}</p><button type="button" :disabled="store.levelsLoading || store.busy" @click="store.loadLevels">重新读取会员档位</button><p v-if="store.levels && !store.levels.length">暂无可用会员档位。</p><label>优惠券（可选）<input v-model="coupon" aria-label="会员优惠券" maxlength="128" :disabled="blocked" /></label><p class="hint">旧接口无效券可能加价至原价1.2倍；不保证优惠、礼包或续购资格，以服务端处理和当前状态为准。</p><div class="plan-grid"><article v-for="level in store.levels" :key="level.id" class="plan"><h3>{{ level.name }}</h3><p>{{ level.code }} · {{ level.durationType }} · 周期参数 {{ level.durationValue }}</p><p class="price">{{ level.price }} 积分</p><ul><li v-for="(value,key) in level.benefits" :key="key">{{ label(String(key)) }}：{{ value }}</li></ul><p v-if="level.unsupported" class="hint">另有未支持的权益配置项。</p><button type="button" :disabled="blocked || !store.state || store.state.active" @click="buy(level)">开通{{ level.name }}（{{ level.durationType }}）</button></article></div></section>
    <p v-if="error || store.error" role="alert" class="error">{{ error || store.error }}</p><p v-if="store.followupError" role="alert" class="error">{{ store.followupError }}</p><p v-if="store.pending" role="status">结果未确认，已锁定后续会员写入。请核对会员状态、背包和积分流水；刷新或退出会清除本机锁定。</p><p v-if="store.completed" role="status">本次会员请求已确认；当前状态以重新读取为准。</p><RouterLink to="/points">查看积分流水</RouterLink>
  </template></div>
</template>
<style scoped lang="scss" src="./membership.scss"></style>
