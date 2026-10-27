<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ProfessionGuide from '@/components/profession/ProfessionGuide.vue'
import { ApiError } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { profileOperationKey } from '@/api/v3-profile'
import { professionModules, professionPresets, professionScopes, fetchV3OwnerProfessions, fetchV3Professions, fetchV3ProfessionDetail, fetchV3ProfessionRecords, writeV3Profession,
  type Mine, type Page, type Profession, type Detail, type ExperienceRecord, type Preset, type Visibility, type ProfessionCommand } from '@/api/v3-professions'
const { accessToken } = storeToRefs(useAuthStore())
const guideId = ref(''), guideName = ref('')
const mine = ref<Mine | null>(null), catalog = ref<Page<Profession> | null>(null)
const mineLoading = ref(false), catalogLoading = ref(false), mineError = ref(''), catalogError = ref('')
const preset = ref<Preset | ''>(''), modules = ref<Visibility | null>(null)
const detailPanel = ref<HTMLElement | null>(null)
const detail = ref<Detail | null>(null), records = ref<Page<ExperienceRecord> | null>(null), selected = ref('')
const detailLoading = ref(false), recordsLoading = ref(false), detailError = ref(''), recordsError = ref('')
const busy = ref(false), error = ref(''), message = ref(''), pending = ref<{ command: ProfessionCommand; key: string } | null>(null)
let mounted = false, generation = 0, mineSequence = 0, catalogSequence = 0, detailSequence = 0, recordsSequence = 0
const primaryLabel = computed(() => {
  if (!mine.value) return ''
  const state = mine.value.state, id = state.primaryProfessionId
  if (!id) return '尚未选择主职业'
  const name = mine.value.list.find(v => v.professionId === id)?.displayName || catalog.value?.list.find(v => v.professionId === id)?.displayName || `已选职业（编号 ${id}）`
  return `${name}${state.primaryProfessionState === 'RETIRED' ? '（已停用）' : state.primaryProfessionState === 'DELETED' ? '（已删除）' : ''}`
})
const disabled = computed(() => busy.value || !!pending.value || mineLoading.value || !mine.value)
function reset() {
  generation++; mineSequence++; catalogSequence++; detailSequence++; recordsSequence++
  guideId.value = guideName.value = ''; mine.value = null; catalog.value = null; detail.value = null; records.value = null; pending.value = null; selected.value = ''; preset.value = ''; modules.value = null
  mineError.value = catalogError.value = detailError.value = recordsError.value = error.value = message.value = ''
  mineLoading.value = catalogLoading.value = detailLoading.value = recordsLoading.value = busy.value = false
}
function guard() { const token = accessToken.value, current = generation; return () => mounted && !!token && token === accessToken.value && current === generation }
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
function date(value: number) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '时间异常' : d.toLocaleString() }
onMounted(() => { mounted = true; void loadMine(1); void loadCatalog(1) })
watch(accessToken, () => { reset(); if (mounted) { void loadMine(1); void loadCatalog(1) } }, { flush: 'sync' })
onBeforeUnmount(() => { mounted = false; reset() })
</script>

<template>
  <div class="owner-professions">
    <p v-if="mineLoading" role="status">正在读取本人职业…</p>
    <p v-if="mineError" role="alert" class="error">{{ mineError }}</p>
    <template v-if="mine">
      <p>当前主职业：{{ primaryLabel }}</p>
      <p class="hint">选择主职业免费，不会自动创建经验或等级。</p>
      <h2>本人职业进度</h2>
      <p v-if="mine.pagination.total === 0">尚未产生职业进度。</p>
      <ul class="items">
        <li v-for="job in mine.list" :key="job.professionId">
          <strong>{{ job.displayName }} <small v-if="job.state === 'RETIRED'">已停用</small></strong>
          <span>{{ job.levelName }} · 经验 {{ job.totalExperience }} · 本级门槛 {{ job.requiredExperience }}</span>
          <span v-if="job.professionId === mine.state.primaryProfessionId">主职业</span>
          <button type="button" @click="openDetail(job.professionId)">查看{{ job.displayName }}详情</button>
        </li>
      </ul>
      <nav v-if="mine.pagination.pageCount > 1" aria-label="本人职业分页">
        <button :disabled="disabled || mine.pagination.p <= 1" @click="loadMine(mine.pagination.p - 1, false)">上一页本人职业</button>
        <span>第 {{ mine.pagination.p }} / {{ mine.pagination.pageCount }} 页，共 {{ mine.pagination.total }} 项</span>
        <button :disabled="disabled || mine.pagination.p >= mine.pagination.pageCount" @click="loadMine(mine.pagination.p + 1, false)">下一页本人职业</button>
      </nav>
      <h2>职业隐私</h2>
      <form @submit.prevent="savePrivacy">
        <fieldset :disabled="disabled">
          <label>职业隐私预设<select v-model="preset" aria-label="职业隐私预设"><option v-for="(label, value) in professionPresets" :key="value" :value="value">{{ label }}</option></select></label>
          <div v-if="preset === 'CUSTOM' && modules" class="module-fields">
            <label v-for="[name, label] in professionModules" :key="name">{{ label }}<select v-model="modules[name]" :aria-label="`${label}可见范围`"><option v-for="(scopeLabel, scope) in professionScopes" :key="scope" :value="scope">{{ scopeLabel }}</option></select></label>
          </div>
          <p class="hint">“仅主职业”的两种预设均只公开主职业，其他模块隐藏；自定义会替换全部十个模块。</p>
          <button type="submit">保存职业隐私</button>
        </fieldset>
      </form>
      <p class="hint">跳过引导会清除当前主职业，已有经验与隐私保持；之后可重新选择。</p>
      <button type="button" :disabled="disabled" @click="start({ kind: 'skip' })">跳过引导并清除主职业</button>
    </template>
    <button type="button" :disabled="mineLoading || busy || !!pending" @click="loadMine()">重新读取本人职业</button>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="message" role="status">{{ message }}</p>
    <p v-if="pending && !busy" class="hint">操作结果尚未确认，重试会恢复同一次设置。</p>
    <button v-if="pending" type="button" :disabled="busy" @click="retry">重试未确认的职业设置</button>
    <h2>可选择的职业</h2>
    <p v-if="catalogLoading" role="status">正在读取职业目录…</p>
    <p v-if="catalogError" role="alert" class="error">{{ catalogError }}</p>
    <template v-if="catalog">
      <p v-if="catalog.pagination.total === 0">暂无可选择的职业。</p>
      <ul class="items"><li v-for="job in catalog.list" :key="job.professionId"><strong>{{ job.displayName }}</strong><span>{{ job.description }}</span><button type="button" :disabled="disabled" @click="start({ kind: 'primary', professionId: job.professionId })">选择{{ job.displayName }}为主职业</button><button type="button" @click="guideId = job.professionId; guideName = job.displayName">查看{{ job.displayName }}成长提示</button></li></ul>
      <nav v-if="catalog.pagination.pageCount > 1" aria-label="职业目录分页">
        <button :disabled="catalogLoading || catalog.pagination.p <= 1" @click="loadCatalog(catalog.pagination.p - 1)">上一页职业目录</button><span>第 {{ catalog.pagination.p }} / {{ catalog.pagination.pageCount }} 页，共 {{ catalog.pagination.total }} 项</span><button :disabled="catalogLoading || catalog.pagination.p >= catalog.pagination.pageCount" @click="loadCatalog(catalog.pagination.p + 1)">下一页职业目录</button>
      </nav>
    </template>
    <button type="button" :disabled="catalogLoading" @click="loadCatalog()">重新读取职业目录</button>
    <ProfessionGuide v-if="guideId" :profession-id="guideId" :name="guideName" />
    <section v-if="selected" ref="detailPanel" tabindex="-1" class="details" aria-label="本人职业详情">
      <h2>职业详情与经验</h2>
      <p v-if="detailLoading" role="status">正在读取详情…</p><p v-if="detailError" role="alert" class="error">{{ detailError }}</p>
      <template v-if="detail">
        <h3>{{ detail.profession.displayName }} · {{ detail.profession.levelName }}</h3><p>{{ detail.profession.description }}</p>
        <h3>等级路线</h3><ol><li v-for="level in detail.levels" :key="level.levelCode"><strong>{{ level.displayName }}{{ level.topLevel ? '（最高等级）' : '' }}</strong> · 累计门槛 {{ level.requiredExperience }}<span>{{ level.description }} {{ level.achievementDescription }}</span></li></ol>
        <h3>贡献汇总</h3><p v-if="!detail.contributions.length">暂无贡献记录。</p><ul><li v-for="item in detail.contributions" :key="item.actionCode">{{ item.actionCode }} · {{ item.experienceSum }} 经验 · {{ item.eventCount }} 次 · 最近 {{ date(item.lastOccurredAt) }}</li></ul>
      </template>
      <button type="button" :disabled="detailLoading" @click="openDetail(selected)">重新读取职业详情</button>
      <h3>最近90天经验记录</h3><p v-if="recordsLoading" role="status">正在读取经验记录…</p><p v-if="recordsError" role="alert" class="error">{{ recordsError }}</p>
      <template v-if="records"><p v-if="records.pagination.total === 0">最近90天没有经验变化记录。</p><ul><li v-for="(item, index) in records.list" :key="index">{{ date(item.occurredAt) }} · {{ item.actionCode }} · {{ item.experienceDelta > 0 ? '+' : '' }}{{ item.experienceDelta }} 经验<span>{{ item.beforeExperience }} → {{ item.afterExperience }} · {{ item.beforeLevelCode }} → {{ item.afterLevelCode }}</span></li></ul><nav v-if="records.pagination.pageCount > 1" aria-label="职业经验分页"><button :disabled="recordsLoading || records.pagination.p <= 1" @click="loadRecords(records.pagination.p - 1)">上一页经验记录</button><span>第 {{ records.pagination.p }} / {{ records.pagination.pageCount }} 页</span><button :disabled="recordsLoading || records.pagination.p >= records.pagination.pageCount" @click="loadRecords(records.pagination.p + 1)">下一页经验记录</button></nav></template>
      <button type="button" :disabled="recordsLoading" @click="loadRecords()">重新读取经验记录</button>
    </section>
  </div>
</template>

<style scoped lang="scss">
h2 { margin: 24px 0 12px; font-size: 18px; } h3 { font-size: 16px; }
.items { list-style: none; padding: 0; } li { margin: 10px 0; overflow-wrap: anywhere; } .items li { display: flex; align-items: flex-start; flex-direction: column; gap: 6px; padding: 12px 0; border-bottom: 1px solid var(--fp-border); }
li > span { display: block; } fieldset { border: 0; padding: 0; margin: 0; }
label { display: grid; gap: 6px; margin: 10px 0; } select { padding: 8px; color: var(--fp-text); background: var(--fp-bg); border: 1px solid var(--fp-border); border-radius: 8px; max-width: 100%; }
.module-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
button { border: 1px solid var(--fp-border); border-radius: 8px; background: transparent; color: var(--fp-text); padding: 7px 12px; cursor: pointer; margin: 6px 8px 6px 0; } button:disabled { opacity: .5; cursor: default; }
nav { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; } .hint { color: var(--fp-muted); font-size: 13px; } .error { color: #c34a36; }
.details { scroll-margin-top: 88px; margin-top: 24px; border-top: 1px solid var(--fp-border); }
@media (max-width: 640px) { .module-fields { grid-template-columns: 1fr; } }
</style>
