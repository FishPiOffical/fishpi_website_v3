<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { professionModules, professionScopes, professionPresets, professionTriggers } from '@/api/v3-professions'
import { fetchLegacyOwnerProfessions, fetchLegacyProfessionDetail, fetchLegacyProfessionRecords, type LegacyOwnerProfessions, type LegacyProfessionCursor, type LegacyProfessionRecords } from '@/api/legacy/owner-professions'
const auth = useAuthStore(), mine = ref<LegacyOwnerProfessions | null>(null), loading = ref(false), error = ref(''), mounted = ref(false)
const selected = ref(''), guideId = ref(''), detail = ref<Awaited<ReturnType<typeof fetchLegacyProfessionDetail>> | null>(null), records = ref<LegacyProfessionRecords | null>(null)
const detailLoading = ref(false), detailError = ref(''), recordsLoading = ref(false), recordsError = ref('')
const recordIndex = ref(0), cursors = ref<(LegacyProfessionCursor | null)[]>([null])
let sequence = 0, detailSequence = 0, recordSequence = 0, targetCursor: LegacyProfessionCursor | null = null, targetIndex = 0
const active = computed(() => mounted.value && !!auth.apiKey && !!auth.account?.oId)
const primaryLabel = computed(() => {
  if (!mine.value) return ''
  const id = mine.value.primaryProfessionId
  return !id ? '尚未选择主职业' : mine.value.catalog.find(job => job.professionId === id)?.displayName || mine.value.snapshots.find(job => job.professionId === id)?.displayName || `职业编号 ${id}`
})
const primaryState = { NONE: '未选择', ACTIVE: '已发布', RETIRED: '已停用', DELETED: '已删除' }
const onboardingState = { UNDECIDED: '尚未选择', SKIPPED: '已跳过', SELECTED: '已选择' }
const guide = computed(() => mine.value && guideId.value ? { triggers: mine.value.growthGuides[guideId.value] || [], rewards: mine.value.rewardGuides[guideId.value] || [] } : null)
function triggerLabel(value: string) { return professionTriggers[value as keyof typeof professionTriggers] || `触发类型：${value}` }
function date(value: number) { return new Date(value).toLocaleString('zh-CN') }
function identity() { return JSON.stringify([getAuthContextVersion(), auth.apiKey, auth.account?.oId]) }
function guard() { const owner = identity(); return () => active.value && owner === identity() }
function clearDetails() { detailSequence++; recordSequence++; selected.value = ''; detail.value = records.value = null; detailError.value = recordsError.value = ''; detailLoading.value = recordsLoading.value = false; recordIndex.value = 0; cursors.value = [null]; targetCursor = null; targetIndex = 0 }
function clear() { sequence++; mine.value = null; loading.value = false; error.value = ''; guideId.value = ''; clearDetails() }
async function read() {
  if (!active.value || import.meta.env.SSR) return
  clear()
  const run = sequence, valid = guard(), owner = auth.account!.oId
  loading.value = true
  try { const result = await fetchLegacyOwnerProfessions(owner); if (valid() && run === sequence) mine.value = result }
  catch (failure) { if (valid() && run === sequence) error.value = failure instanceof Error ? failure.message : '本人职业读取失败' }
  finally { if (valid() && run === sequence) loading.value = false }
}
async function readDetail(id = selected.value) {
  if (!active.value || !id || import.meta.env.SSR) return
  if (id !== selected.value) { clearDetails(); selected.value = id; void readRecords(null, 0) }
  const run = ++detailSequence, valid = guard()
  detailLoading.value = true; detail.value = null; detailError.value = ''
  try { const result = await fetchLegacyProfessionDetail(id); if (valid() && run === detailSequence && selected.value === id) detail.value = result }
  catch (failure) { if (valid() && run === detailSequence && selected.value === id) detailError.value = failure instanceof Error ? failure.message : '职业详情读取失败' }
  finally { if (valid() && run === detailSequence && selected.value === id) detailLoading.value = false }
}
async function readRecords(cursor = targetCursor, index = targetIndex) {
  if (!active.value || !selected.value || index < 0 || import.meta.env.SSR) return
  targetCursor = cursor ? { ...cursor } : null; targetIndex = index
  const run = ++recordSequence, id = selected.value, valid = guard(), commandCursor = targetCursor
  records.value = null; recordsLoading.value = true; recordsError.value = ''
  try {
    const result = await fetchLegacyProfessionRecords(id, commandCursor)
    if (valid() && run === recordSequence && selected.value === id) { records.value = result; recordIndex.value = index; cursors.value = [...cursors.value.slice(0, index), commandCursor] }
  } catch (failure) { if (valid() && run === recordSequence && selected.value === id) recordsError.value = failure instanceof Error ? failure.message : '经验记录读取失败' }
  finally { if (valid() && run === recordSequence && selected.value === id) recordsLoading.value = false }
}
onMounted(() => { mounted.value = true; void read() })
watch([() => auth.apiKey, () => auth.account?.oId], () => { clear(); void read() }, { flush: 'sync' })
onScopeDispose(() => { mounted.value = false; clear() })
</script>
<template>
  <div class="owner-professions">
    <p class="hint">旧版支持查看本人职业资料。主职业选择和隐私修改仍要求经典页面的会话验证，此处暂不提供修改操作。</p>
    <p v-if="loading" role="status">正在读取本人职业…</p><p v-if="error" role="alert" class="error">{{ error }}</p>
    <button type="button" :disabled="loading || !active" @click="read">重新读取本人职业</button>
    <template v-if="mine">
      <p>当前主职业：{{ primaryLabel }} · {{ primaryState[mine.primaryProfessionState] }}</p><p>选择状态：{{ onboardingState[mine.onboardingState] }}</p>
      <h2>职业隐私</h2><p>{{ professionPresets[mine.privacyPreset] }}</p>
      <dl class="privacy"><template v-for="[name, label] in professionModules" :key="name"><dt>{{ label }}</dt><dd>{{ professionScopes[mine.moduleVisibility[name]] }}</dd></template></dl>
      <h2>职业等级快照</h2><p class="hint">旧版可能为仅选择的职业附带初始等级，不凭快照推断已有实际进度。</p>
      <p v-if="!mine.snapshots.length">暂无职业等级快照。</p>
      <ul class="items"><li v-for="(job,index) in mine.snapshots" :key="index"><strong>{{ job.displayName }}</strong><span>{{ job.levelName }} · 经验 {{ job.totalExperience }} · 本级门槛 {{ job.requiredExperience }}</span><button type="button" @click="readDetail(job.professionId)">查看{{ job.displayName }}详情</button></li></ul>
      <h2>职业目录</h2><p v-if="!mine.catalog.length">暂无已发布职业。</p>
      <ul class="items"><li v-for="job in mine.catalog" :key="job.professionId"><strong>{{ job.displayName }}</strong><p>{{ job.description }}</p><div><button type="button" @click="readDetail(job.professionId)">查看{{ job.displayName }}等级路线</button><button type="button" :aria-expanded="guideId === job.professionId" @click="guideId = guideId === job.professionId ? '' : job.professionId">{{ guideId === job.professionId ? '收起' : '查看' }}{{ job.displayName }}成长提示</button></div></li></ul>
      <section v-if="guide" aria-label="职业成长提示"><h3>成长来源</h3><ul><li v-for="(trigger,index) in guide.triggers" :key="index">{{ triggerLabel(trigger) }}</li></ul><p v-if="!guide.triggers.length">暂无已发布的成长来源。</p><h3>等级奖励概要</h3><ul><li v-for="(reward,index) in guide.rewards" :key="index">{{ reward.rewardType === 'POINT' ? `${reward.amount} 积分` : '勋章奖励' }}</li></ul><p v-if="!guide.rewards.length">暂无已发布的奖励概要。</p><p class="hint">成长来源与奖励概要不保证每次操作都会增加经验或发放奖励。</p></section>
    </template>
    <section v-if="selected" class="details" aria-label="本人职业详情">
      <h2>职业详情与经验</h2><p v-if="detailLoading" role="status">正在读取详情…</p><p v-if="detailError" role="alert" class="error">{{ detailError }}</p>
      <template v-if="detail"><h3>{{ detail.profession.displayName }} · {{ detail.profession.levelName }}</h3><p>{{ detail.profession.description }}</p><h3>等级路线</h3><ol><li v-for="level in detail.levels" :key="level.levelCode"><strong>{{ level.displayName }}{{ level.topLevel ? '（最高等级）' : '' }}</strong> · 累计门槛 {{ level.requiredExperience }}<span>{{ level.description }} {{ level.achievementDescription }}</span></li></ol><h3>贡献汇总</h3><p v-if="!detail.contributions.length">暂无贡献记录。</p><ul><li v-for="(item,index) in detail.contributions" :key="index">{{ item.actionCode }} · {{ item.experienceSum }} 经验 · {{ item.eventCount }} 次 · 最近 {{ date(item.lastOccurredAt) }}</li></ul></template>
      <button type="button" :disabled="detailLoading" @click="readDetail()">重新读取职业详情</button>
      <h3>最近90天经验记录</h3><p v-if="recordsLoading" role="status">正在读取经验记录…</p><p v-if="recordsError" role="alert" class="error">{{ recordsError }}</p>
      <template v-if="records"><p v-if="!records.list.length">本批没有经验记录。</p><ul><li v-for="(item,index) in records.list" :key="index">{{ date(item.occurredAt) }} · {{ item.sourceLabel || item.actionCode }} · {{ item.experienceDelta > 0 ? '+' : '' }}{{ item.experienceDelta }} 经验<span>{{ item.beforeExperience }} → {{ item.afterExperience }} · {{ item.beforeLevelCode }} → {{ item.afterLevelCode }}</span></li></ul><nav aria-label="职业经验游标分页"><button type="button" :disabled="recordIndex === 0" @click="readRecords(cursors[recordIndex - 1] || null, recordIndex - 1)">上一批经验记录</button><span>第 {{ recordIndex + 1 }} 批</span><button type="button" :disabled="!records.next" @click="readRecords(records.next, recordIndex + 1)">下一批经验记录</button></nav></template>
      <button type="button" :disabled="recordsLoading" @click="readRecords()">重新读取经验记录</button>
    </section>
  </div>
</template>
<style scoped lang="scss" src="./owner-professions.scss"></style>
