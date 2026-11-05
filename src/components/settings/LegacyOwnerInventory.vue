<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useLegacyInventoryStore } from '@/stores/legacyInventory'
import { getAuthContextVersion } from '@/api/http'
import { legacyCardLabels, legacyInventoryInput, type LegacyInventoryCommand } from '@/api/legacy/inventory'
import { fpConfirm } from '@/composables/useDialog'
const auth = useAuthStore(), store = useLegacyInventoryStore(), name = ref(''), confirming = ref(false), mounted = ref(false), localError = ref('')
const labels: Record<string, string> = { ...legacyCardLabels, metalTicket: '周年勋章领取券', sysCheckinRemain: '剩余免签天数', patchStart: '补签记录起始日' }
const blocked = computed(() => store.busy || !!store.pending || confirming.value)
const identity = () => JSON.stringify([getAuthContextVersion(), auth.apiKey, auth.account?.oId])
let confirmation: AbortController | null = null
function cancel() { confirmation?.abort(); confirmation = null; confirming.value = false }
function usable(code: string): code is LegacyInventoryCommand['kind'] { return Object.hasOwn(legacyCardLabels, code) }
async function use(kind: LegacyInventoryCommand['kind']) {
  if (!mounted.value || blocked.value || !store.items?.some(item => item.code === kind && item.count > 0)) return
  let input: LegacyInventoryCommand
  localError.value = ''
  try { input = legacyInventoryInput(kind === 'nameCard' ? { kind, userName: name.value } : { kind }) } catch (failure) { localError.value = failure instanceof Error ? failure.message : '参数不合法'; return }
  const owner = identity(), controller = new AbortController()
  confirmation = controller; confirming.value = true
  const descriptions = { checkin1day: '消耗1张单日免签卡，增加1天剩余免签天数，不会立即完成今日签到。', checkin2days: '消耗1张两日免签卡，增加2天剩余免签天数，不会立即完成今日签到。', patchCheckinCard: '消耗1张补签卡，须今天已签到且满足服务端补签条件，不额外发积分。', nameCard: '' }
  try {
    const approved = await fpConfirm({ title: `确认使用${legacyCardLabels[kind]}`, message: (input.kind === 'nameCard' ? `消耗1张改名卡，将用户名改为 ${input.userName}，仍须通过服务端校验。` : descriptions[input.kind]) + '旧接口无法幂等恢复，结果不确定时需先核对，是否继续？', confirmText: '确认使用', signal: controller.signal })
    if (approved && !controller.signal.aborted && mounted.value && owner === identity() && !store.busy && !store.pending) {
      const result = await store.use(input)
      if (result && input.kind === 'nameCard' && name.value.trim() === input.userName) name.value = ''
    }
  } finally { if (confirmation === controller) { confirmation = null; confirming.value = false } }
}
watch(identity, () => { cancel(); name.value = ''; localError.value = ''; if (mounted.value) void store.load() }, { flush: 'sync' })
onMounted(() => { mounted.value = true; void store.load() })
onScopeDispose(() => { mounted.value = false; cancel() })
</script>
<template>
  <section class="owner-inventory" aria-label="本人背包和用户名">
    <h2>你的背包</h2><button type="button" :disabled="store.loading || store.busy" @click="store.load">重新读取背包</button>
    <p v-if="store.loading" role="status">正在读取背包…</p><p v-else-if="store.readError" role="alert" class="error">{{ store.readError }}</p>
    <template v-else-if="store.items">
      <p v-if="!store.items.some(item => item.count > 0)">当前背包快照没有物品或生效中的免签天数。</p>
      <ul><li v-for="item in store.items.filter(row => row.count !== 0)" :key="item.code"><span>{{ labels[item.code] || item.code }}：{{ item.count }}</span><button v-if="usable(item.code) && item.code !== 'nameCard'" type="button" :disabled="blocked" @click="use(item.code)">使用{{ labels[item.code] }}</button></li></ul>
      <form v-if="store.items.some(item => item.code === 'nameCard' && item.count > 0)" @submit.prevent="use('nameCard')"><fieldset :disabled="blocked"><label>改名卡新用户名<input v-model="name" aria-label="改名卡新用户名" maxlength="64" autocomplete="off" /></label><button type="submit">使用一张改名卡</button></fieldset></form>
    </template>
    <p class="hint">免签卡用于后续系统签到；补签最终以服务端校验为准。周年勋章领取券仅展示，未知道具只展示原编号与数量。</p>
    <p>当前用户名：{{ auth.account?.userName || '—' }}</p><p class="hint">旧版积分改名仍依赖经典页面会话，此处暂不提供积分改名操作。</p>
    <p v-if="localError" role="alert" class="error">{{ localError }}</p><p v-if="store.error" role="alert" class="error">{{ store.error }}</p><p v-if="store.followupError" role="alert" class="error">{{ store.followupError }}</p>
    <p v-if="store.pending" role="status">道具结果未确认，请核对背包与用户名后再解除锁定。离开页面会保留本次锁定，刷新或退出会清除本机状态。</p>
    <p v-if="store.completed" role="status">{{ legacyCardLabels[store.completed.kind] }}使用已确认，当前背包及用户名以重新读取为准。</p>
  </section>
</template>
<style scoped lang="scss" src="./owner-inventory.scss"></style>
