<script setup lang="ts">
import { formatDateTime } from '@/utils/time'

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ProfessionGuide from '@/components/profession/ProfessionGuide.vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { profileOperationKey } from '@/api/v3-profile'
import { professionTriggers, professionModules, professionPresets, professionScopes, fetchV3OwnerProfessions, fetchV3Professions, fetchV3ProfessionDetail, fetchV3ProfessionRecords, writeV3Profession,
  type Mine, type Page, type Profession, type Detail, type ExperienceRecord, type Preset, type Visibility, type ProfessionCommand } from '@/api/v3-professions'
const { accessToken, account } = storeToRefs(useAuthStore())
const guideId = ref(''), guideName = ref('')
const mine = ref<Mine | null>(null), catalog = ref<Page<Profession> | null>(null)
const mineLoading = ref(false), catalogLoading = ref(false), mineError = ref(''), catalogError = ref('')
const preset = ref<Preset | ''>(''), modules = ref<Visibility | null>(null)
const detailPanel = ref<HTMLElement | null>(null)
const detail = ref<Detail | null>(null), records = ref<Page<ExperienceRecord> | null>(null), selected = ref('')
const detailLoading = ref(false), recordsLoading = ref(false), detailError = ref(''), recordsError = ref('')
const busy = ref(false), error = ref(''), message = ref(''), pending = ref<{ command: ProfessionCommand; key: string } | null>(null)
let mounted = false, generation = 0, mineSequence = 0, catalogSequence = 0, detailSequence = 0, recordsSequence = 0
function identity() { return JSON.stringify([getAuthContextVersion(), !!accessToken.value, account.value?.oId || '']) }
let boundary = identity()
const primaryLabel = computed(() => {
  if (!mine.value) return ''
  const state = mine.value.state, id = state.primaryProfessionId
  if (!id) return '尚未选择主职业'
  const name = mine.value.list.find(v => v.professionId === id)?.displayName || catalog.value?.list.find(v => v.professionId === id)?.displayName || `已选职业（编号 ${id}）`
  return `${name}${state.primaryProfessionState === 'RETIRED' ? '（已停用）' : state.primaryProfessionState === 'DELETED' ? '（已删除）' : ''}`
})
const primaryProgress = computed(() => mine.value?.list.find(job => job.professionId === mine.value?.state.primaryProfessionId))
const disabled = computed(() => busy.value || !!pending.value || mineLoading.value || !mine.value)
function reset() {
  generation++; mineSequence++; catalogSequence++; detailSequence++; recordsSequence++
  guideId.value = guideName.value = ''; mine.value = null; catalog.value = null; detail.value = null; records.value = null; pending.value = null; selected.value = ''; preset.value = ''; modules.value = null
  mineError.value = catalogError.value = detailError.value = recordsError.value = error.value = message.value = ''
  mineLoading.value = catalogLoading.value = detailLoading.value = recordsLoading.value = busy.value = false
}
function guard() { const owner = identity(), current = generation; return () => mounted && !!accessToken.value && owner === identity() && current === generation }
async function loadMine(p = mine.value?.pagination.p || 1, syncDraft = true) {
  if (!accessToken.value) return
  const valid = guard(), sequence = ++mineSequence
  mineLoading.value = true; mineError.value = ''; mine.value = null
  try {
    let value = await fetchV3OwnerProfessions(p)
    if (value.pagination.pageCount > 0 && p > value.pagination.pageCount) value = await fetchV3OwnerProfessions(value.pagination.pageCount)
    if (valid() && sequence === mineSequence) {
      mine.value = value
      if (syncDraft) { preset.value = value.state.privacyPreset; modules.value = { ...value.state.moduleVisibility } }
    }
  } catch (failure) { if (valid() && sequence === mineSequence) mineError.value = failure instanceof Error ? failure.message : '职业读取失败' }
  finally { if (valid() && sequence === mineSequence) mineLoading.value = false }
}
async function loadCatalog(p = catalog.value?.pagination.p || 1) {
  if (!accessToken.value) return
  const valid = guard(), sequence = ++catalogSequence
  catalogLoading.value = true; catalogError.value = ''; catalog.value = null
  try {
    let value = await fetchV3Professions(p)
    if (value.pagination.pageCount > 0 && p > value.pagination.pageCount) value = await fetchV3Professions(value.pagination.pageCount)
    if (valid() && sequence === catalogSequence) catalog.value = value
  } catch (failure) { if (valid() && sequence === catalogSequence) catalogError.value = failure instanceof Error ? failure.message : '职业目录读取失败' }
  finally { if (valid() && sequence === catalogSequence) catalogLoading.value = false }
}
async function openDetail(id: string) {
  if (!accessToken.value) return
  selected.value = id; detail.value = null; records.value = null; recordsSequence++; recordsLoading.value = false; recordsError.value = ''
  const valid = guard(), sequence = ++detailSequence
  detailLoading.value = true; detailError.value = ''
  void nextTick(() => { if (valid() && sequence === detailSequence) { detailPanel.value?.focus({ preventScroll: true }); detailPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } })
  void loadRecords(1)
  try { const value = await fetchV3ProfessionDetail(id); if (valid() && sequence === detailSequence && selected.value === id) detail.value = value }
  catch (failure) { if (valid() && sequence === detailSequence) detailError.value = failure instanceof Error ? failure.message : '职业详情读取失败' }
  finally { if (valid() && sequence === detailSequence) detailLoading.value = false }
}
async function loadRecords(p = records.value?.pagination.p || 1) {
  if (!accessToken.value || !selected.value) return
  const id = selected.value, valid = guard(), sequence = ++recordsSequence
  recordsLoading.value = true; records.value = null; recordsError.value = ''
  try {
    let value = await fetchV3ProfessionRecords(id, p)
    if (value.pagination.pageCount > 0 && p > value.pagination.pageCount) value = await fetchV3ProfessionRecords(id, value.pagination.pageCount)
    if (valid() && sequence === recordsSequence && id === selected.value) records.value = value
  } catch (failure) { if (valid() && sequence === recordsSequence) recordsError.value = failure instanceof Error ? failure.message : '经验记录读取失败' }
  finally { if (valid() && sequence === recordsSequence) recordsLoading.value = false }
}
async function execute(intent: { command: ProfessionCommand; key: string }) {
  if (!accessToken.value || busy.value) return
  const valid = guard(), currentPage = mine.value?.pagination.p || 1
  pending.value = intent; busy.value = true; error.value = message.value = ''
  try {
    const result = await writeV3Profession(intent.command, intent.key)
    if (valid()) {
      pending.value = null
      if (intent.command.kind === 'privacy') { preset.value = result.privacyPreset as Preset; modules.value = { ...(result.moduleVisibility as Visibility) } }
      message.value = intent.command.kind === 'primary' ? '主职业已保存' : intent.command.kind === 'skip' ? '已跳过引导并清除主职业' : '职业隐私已保存'
      await loadMine(currentPage, false)
    }
  } catch (failure) {
    if (valid()) { error.value = failure instanceof Error ? failure.message : '职业设置失败'; if (failure instanceof ApiError && failure.status >= 400 && failure.status < 500) pending.value = null }
  } finally { if (valid()) busy.value = false }
}
function start(command: ProfessionCommand) { if (!disabled.value) void execute({ command, key: profileOperationKey() }) }
function savePrivacy() { if (preset.value && modules.value) start({ kind: 'privacy', preset: preset.value, ...(preset.value === 'CUSTOM' ? { moduleVisibility: { ...modules.value } } : {}) }) }
function retry() { if (pending.value) void execute(pending.value) }
function actionLabel(code: string) { return professionTriggers[code as keyof typeof professionTriggers] || code }
const date = formatDateTime
onMounted(() => { mounted = true; void loadMine(1); void loadCatalog(1) })
watch([accessToken, () => account.value?.oId], () => {
  const current = identity()
  if (current === boundary) return
  boundary = current; reset()
  if (mounted) { void loadMine(1); void loadCatalog(1) }
}, { flush: 'sync' })
onBeforeUnmount(() => { mounted = false; reset() })
</script>

<template>
  <div class="owner-professions">
    <header class="profession-overview">
      <div class="overview-copy"><span class="eyebrow">职业档案</span><h2>{{ mine ? primaryLabel : '我的职业' }}</h2><p>选择你的主职业，在主页与用户名片中展示。</p></div>
      <div v-if="primaryProgress" class="overview-level"><strong>{{ primaryProgress.levelName }}</strong><span>{{ primaryProgress.totalExperience.toLocaleString() }} 经验</span></div>
      <button class="fp-control icon-button" type="button" :disabled="mineLoading || busy || !!pending" @click="loadMine()" title="刷新职业资料" aria-label="刷新职业资料"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg></button>
    </header>
    <p v-if="mineLoading" role="status">正在读取本人职业…</p>
    <p v-if="mineError" role="alert" class="error">{{ mineError }}</p>
    <div v-if="error || message || pending" class="operation-status" aria-live="polite">
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p v-if="message" role="status">{{ message }}</p>
      <p v-if="pending && !busy" class="hint">设置结果尚未确认，可重试本次操作。</p>
      <button v-if="pending" class="fp-control icon-button" type="button" :disabled="busy" @click="retry" title="重试本次设置" aria-label="重试未确认的职业设置"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg></button>
    </div>

    <section class="profession-section" aria-labelledby="profession-choices-title">
      <header class="section-heading"><div><h2 id="profession-choices-title">选择主职业</h2><p>切换免费，已有的职业经验仍会保留。</p></div><button class="fp-control icon-button" type="button" :disabled="catalogLoading" @click="loadCatalog()" title="刷新职业目录" aria-label="刷新职业目录"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg></button></header>
      <p v-if="catalogLoading" role="status">正在读取职业目录…</p>
      <p v-if="catalogError" role="alert" class="error">{{ catalogError }}</p>
      <template v-if="catalog">
        <p v-if="catalog.pagination.total === 0" class="empty-state">暂无可选择的职业。</p>
        <ul class="profession-choices">
          <li v-for="job in catalog.list" :key="job.professionId" class="profession-choice" :class="{ 'is-selected': job.professionId === mine?.state.primaryProfessionId }">
            <div class="choice-heading"><span class="profession-mark" aria-hidden="true">{{ (job.shortName || job.displayName).slice(0, 1) }}</span><div><h3>{{ job.displayName }}</h3><span class="hint">{{ job.shortName }}</span></div><span v-if="job.professionId === mine?.state.primaryProfessionId" class="selection-badge">当前主职业</span></div>
            <p class="choice-description">{{ job.description }}</p>
            <div class="choice-actions"><button class="fp-control" type="button" :disabled="disabled" :aria-pressed="job.professionId === mine?.state.primaryProfessionId" :aria-label="`选择${job.displayName}为主职业`" @click="start({ kind: 'primary', professionId: job.professionId })">{{ job.professionId === mine?.state.primaryProfessionId ? '已选择' : '设为主职业' }}</button><button class="fp-control text-button" type="button" :aria-label="`查看${job.displayName}成长提示`" @click="guideId = job.professionId; guideName = job.displayName">成长指南 <span aria-hidden="true">↗</span></button></div>
          </li>
        </ul>
        <nav v-if="catalog.pagination.pageCount > 1" aria-label="职业目录分页"><button class="fp-control" :disabled="catalogLoading || catalog.pagination.p <= 1" @click="loadCatalog(catalog.pagination.p - 1)">上一页</button><span>{{ catalog.pagination.p }} / {{ catalog.pagination.pageCount }} · {{ catalog.pagination.total }} 项</span><button class="fp-control" :disabled="catalogLoading || catalog.pagination.p >= catalog.pagination.pageCount" @click="loadCatalog(catalog.pagination.p + 1)">下一页</button></nav>
      </template>
      <ProfessionGuide v-if="guideId" :profession-id="guideId" :name="guideName" />
    </section>

    <section v-if="mine" class="profession-section" aria-labelledby="profession-progress-title">
      <header class="section-heading"><div><h2 id="profession-progress-title">职业进度</h2><p>查看已积累的经验与等级记录。</p></div></header>
      <p v-if="mine.pagination.total === 0" class="empty-state">尚未产生职业进度，选择主职业不会自动增加经验。</p>
      <ul class="progress-list"><li v-for="job in mine.list" :key="job.professionId" :class="{ 'is-active': selected === job.professionId }"><div class="progress-identity"><strong>{{ job.displayName }}</strong><span>{{ job.levelName }}<small v-if="job.state === 'RETIRED'"> · 已停用</small><small v-if="job.professionId === mine.state.primaryProfessionId"> · 主职业</small></span></div><div class="progress-experience"><strong>{{ job.totalExperience.toLocaleString() }} <small>经验</small></strong><span>本级门槛 {{ job.requiredExperience.toLocaleString() }}</span></div><button class="fp-control" type="button" :aria-label="`查看${job.displayName}详情`" @click="openDetail(job.professionId)">查看详情 <span aria-hidden="true">→</span></button></li></ul>
      <nav v-if="mine.pagination.pageCount > 1" aria-label="本人职业分页"><button class="fp-control" :disabled="disabled || mine.pagination.p <= 1" @click="loadMine(mine.pagination.p - 1, false)">上一页</button><span>{{ mine.pagination.p }} / {{ mine.pagination.pageCount }} · {{ mine.pagination.total }} 项</span><button class="fp-control" :disabled="disabled || mine.pagination.p >= mine.pagination.pageCount" @click="loadMine(mine.pagination.p + 1, false)">下一页</button></nav>
    </section>

    <section v-if="selected" ref="detailPanel" tabindex="-1" class="profession-section details" aria-label="本人职业详情">
      <header class="section-heading"><div><h2>{{ detail ? detail.profession.displayName : '职业详情' }}</h2><p v-if="detail">{{ detail.profession.levelName }} · {{ detail.profession.description }}</p></div><button class="fp-control icon-button" type="button" :disabled="detailLoading" @click="openDetail(selected)" title="刷新职业详情" aria-label="刷新职业详情"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg></button></header>
      <p v-if="detailLoading" role="status">正在读取详情…</p><p v-if="detailError" role="alert" class="error">{{ detailError }}</p>
      <template v-if="detail">
        <h3 class="subheading">等级路线</h3>
        <ol class="level-roadmap"><li v-for="level in detail.levels" :key="level.levelCode" :class="{ 'is-current': level.levelCode === detail.profession.levelCode }"><span class="level-node" aria-hidden="true"></span><div class="level-body"><div class="level-heading"><strong>{{ level.displayName }}</strong><span v-if="level.levelCode === detail.profession.levelCode" class="selection-badge">当前等级</span><span v-else-if="level.topLevel" class="hint">最高等级</span><span class="level-threshold">{{ level.requiredExperience.toLocaleString() }} 经验</span></div><p v-if="level.description || level.achievementDescription">{{ level.description }} {{ level.achievementDescription }}</p></div></li></ol>
        <h3 class="subheading">贡献汇总</h3><p v-if="!detail.contributions.length" class="empty-state">暂无贡献记录。</p><ul v-else class="contribution-list"><li v-for="item in detail.contributions" :key="item.actionCode"><div><strong>{{ actionLabel(item.actionCode) }}</strong><span>{{ item.eventCount }} 次 · 最近 {{ date(item.lastOccurredAt) }}</span></div><strong>{{ item.experienceSum.toLocaleString() }} <small>经验</small></strong></li></ul>
      </template>
      <header class="section-heading records-heading"><h3>近 90 天经验记录</h3><button class="fp-control icon-button" type="button" :disabled="recordsLoading" @click="loadRecords()" title="刷新经验记录" aria-label="刷新经验记录"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg></button></header>
      <p v-if="recordsLoading" role="status">正在读取经验记录…</p><p v-if="recordsError" role="alert" class="error">{{ recordsError }}</p>
      <template v-if="records"><p v-if="records.pagination.total === 0" class="empty-state">最近 90 天没有经验变化记录。</p><ul v-else class="experience-list"><li v-for="(item, index) in records.list" :key="index"><div><strong>{{ actionLabel(item.actionCode) }}</strong><time>{{ date(item.occurredAt) }}</time><span>{{ item.beforeExperience }} → {{ item.afterExperience }} · {{ item.beforeLevelCode }} → {{ item.afterLevelCode }}</span></div><strong class="experience-delta" :class="{ 'is-positive': item.experienceDelta > 0, 'is-negative': item.experienceDelta < 0 }">{{ item.experienceDelta > 0 ? '+' : '' }}{{ item.experienceDelta.toLocaleString() }} <small>经验</small></strong></li></ul><nav v-if="records.pagination.pageCount > 1" aria-label="职业经验分页"><button class="fp-control" :disabled="recordsLoading || records.pagination.p <= 1" @click="loadRecords(records.pagination.p - 1)">上一页</button><span>{{ records.pagination.p }} / {{ records.pagination.pageCount }}</span><button class="fp-control" :disabled="recordsLoading || records.pagination.p >= records.pagination.pageCount" @click="loadRecords(records.pagination.p + 1)">下一页</button></nav></template>
    </section>

    <section v-if="mine" class="profession-section" aria-labelledby="profession-privacy-title">
      <header class="section-heading"><div><h2 id="profession-privacy-title">展示范围</h2><p>决定他人能看到哪些职业资料。</p></div></header>
      <form @submit.prevent="savePrivacy"><fieldset :disabled="disabled">
        <label class="preset-field">可见范围<select class="fp-control" v-model="preset" aria-label="职业隐私预设"><option v-for="(label, value) in professionPresets" :key="value" :value="value">{{ label }}</option></select></label>
        <div v-if="preset === 'CUSTOM' && modules" class="module-fields"><label v-for="[name, label] in professionModules" :key="name">{{ label }}<select class="fp-control" v-model="modules[name]" :aria-label="`${label}可见范围`"><option v-for="(scopeLabel, scope) in professionScopes" :key="scope" :value="scope">{{ scopeLabel }}</option></select></label></div>
        <p class="hint">两种“仅主职业”预设均隐藏其他模块；自定义设置会保存全部十项范围。</p><button data-tone="primary" class="fp-control" type="submit">保存展示范围</button>
      </fieldset></form>
      <div class="clear-profession"><div><strong>暂不展示主职业</strong><p>清除当前选择，保留已有经验和隐私设置，之后可重新选择。</p></div><button class="fp-control" type="button" :disabled="disabled" @click="start({ kind: 'skip' })">清除主职业</button></div>
    </section>
  </div>
</template>

<style scoped lang="scss" src="./owner-professions.scss"></style>
