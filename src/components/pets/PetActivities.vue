<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { PetActivityEntry, PetActivityKind, PetActivityRewards, PetJobEntry } from '@/api/v3-pets'
import { getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore } from '@/stores/pets'
import { formatDate } from '@/utils/time'
import PetIcon from './PetIcon.vue'
import { petDuration, usePetClock } from './usePetClock'
import { petActivityLabels, petJobNames, petSkillNames } from './petActivityStatus'

const pets = usePetsStore(), auth = useAuthStore()
const { now } = usePetClock()
const tab = ref<PetActivityKind>('outing')
let refreshedDate = ''
const tabs = [{ id: 'outing', name: '外出' }, { id: 'course', name: '学校' }, { id: 'work', name: '兼职' }] as const
const locked = computed(() => pets.loading || pets.busy || !!pets.pending || pets.refreshNeeded)
const activity = computed(() => {
  const value = pets.pet?.activity
  return value && value.kind !== 'rest' ? value : null
})
const claimable = computed(() => !!activity.value && (activity.value.status === 'claimable' || activity.value.endsAt <= now.value))
const progress = computed(() => {
  const value = activity.value
  return value ? Math.max(0, Math.min(100, (now.value - value.startedAt) / Math.max(1, value.endsAt - value.startedAt) * 100)) : 0
})
const entries = computed(() => tab.value === 'outing' ? pets.catalog?.places ?? [] : tab.value === 'course' ? pets.catalog?.courses ?? [] : pets.catalog?.jobs ?? [])
const skills = computed(() => pets.catalog
  ? pets.catalog.skills.map(skill => ({ ...skill, progress: pets.pet?.skills.find(value => value.id === skill.id) }))
  : pets.pet?.skills.map(progress => ({ id: progress.id, name: petSkillNames[progress.id], description: '', progress })) ?? [])
const jobs = computed(() => pets.catalog
  ? pets.catalog.jobs.map(job => ({ id: job.id, name: job.name, progress: pets.pet?.jobs.find(value => value.id === job.id) }))
  : pets.pet?.jobs.map(progress => ({ id: progress.id, name: petJobNames[progress.id] || progress.id, progress })) ?? [])
const occupiedText = computed(() => pets.pet?.activity?.kind === 'rest' ? '正在休息，醒来后再安排活动。' : claimable.value ? '先领取本次成果，再安排下一次活动。' : '一次只安排一项活动，结束后回来领取成果。')

function rewards(value: PetActivityRewards) {
  const lines: string[] = []
  if (value.coins) lines.push(`宠物币 +${value.coins}`)
  if (value.experience) lines.push(`经验 +${value.experience}`)
  if (value.food) lines.push(`口粮 +${value.food}`)
  if (value.mood) lines.push(`心情 +${value.mood}`)
  if (value.proficiency) lines.push(`熟练度 +${value.proficiency}`)
  for (const skill of value.skills) {
    const name = pets.catalog?.skills.find(item => item.id === skill.id)?.name || petSkillNames[skill.id]
    if (name && skill.experience) lines.push(`${name} +${skill.experience}`)
  }
  return lines
}
function requirement(entry: PetActivityEntry | PetJobEntry) {
  if (!('requirement' in entry)) return ''
  const name = pets.catalog?.skills.find(skill => skill.id === entry.requirement.skillId)?.name || petSkillNames[entry.requirement.skillId]
  return `${name}经验 ${entry.requirement.experience}`
}
function reason(entry: PetActivityEntry | PetJobEntry) {
  if (pets.pet?.activity) return occupiedText.value
  const pet = pets.pet
  if (!pet || !pets.state) return '请先读取当前宠物状态'
  if (tab.value === 'work') {
    if (pets.state.income.remaining <= 0) return '今日工作收入已达上限'
    if ('requirement' in entry) {
      const experience = pet.skills.find(skill => skill.id === entry.requirement.skillId)?.experience
      if (experience === undefined) return '技能状态暂不可用'
      if (experience < entry.requirement.experience) return `需要${requirement(entry)}`
    }
  }
  if (pets.state.wallet.coins < entry.cost.coins) return '宠物币不足'
  if (pet.energy < entry.cost.energy) return '精力不足，先休息一下'
  if (pet.hunger < entry.cost.hunger) return '饱食不足，先吃点东西'
  if (pet.water < entry.cost.water) return '水分不足，先喝点水'
  return ''
}
function start(entry: PetActivityEntry | PetJobEntry) {
  if (locked.value || reason(entry)) return
  void pets.startActivity(tab.value, entry.id)
}
function claim() {
  if (!claimable.value || locked.value) return
  void pets.claimActivity()
}
function moveTab(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const index = tabs.findIndex(item => item.id === tab.value)
  tab.value = event.key === 'Home' ? 'outing' : event.key === 'End' ? 'work' : tabs[(index + (event.key === 'ArrowRight' ? 1 : 2)) % tabs.length]!.id
  void nextTick(() => document.getElementById(`pet-${tab.value}-tab`)?.focus())
}
watch(() => `${getAuthContextVersion()}:${auth.account?.oId ?? ''}:${!!auth.accessToken}`, () => { tab.value = 'outing'; refreshedDate = '' })
watch([now, () => pets.state?.today, () => pets.loading, () => pets.busy], () => {
  if (!pets.state || pets.loading || pets.busy || pets.pending || document.hidden) return
  const today = formatDate(now.value, '')
  if (!today || today === pets.state.today || today === refreshedDate) return
  // 跨日只核对一次服务器额度，不在本地重置收入，也不在失败后循环重试。
  refreshedDate = today
  void pets.refresh()
})
</script>

<template>
  <section v-if="pets.pet" id="pet-activities" class="pet-activities" aria-labelledby="pet-activities-title">
    <header class="activities-heading"><div><h2 id="pet-activities-title">安排一段充实的时光</h2><p>出去看看、学习本领，也可以试着做一份兼职。</p></div><PetIcon name="outing" /></header>

    <div v-if="activity" class="current-activity" :class="{ claimable }">
      <div class="current-icon"><PetIcon :name="claimable ? 'gift' : activity.kind" /></div>
      <div class="current-copy"><span aria-live="polite">本次{{ petActivityLabels[activity.kind] }} · {{ claimable ? '已完成' : '进行中' }}</span><h3>{{ activity.name }}</h3><p>{{ claimable ? '新的收获等你带回家。' : `还剩 ${petDuration(activity.endsAt - now)}` }}</p></div>
      <button v-if="claimable" type="button" class="activity-primary" :disabled="locked" @click="claim">领取成果</button>
      <span v-else class="current-duration"><PetIcon name="clock" />{{ petDuration(activity.endsAt - activity.startedAt) }}</span>
      <div class="activity-progress" role="progressbar" aria-label="当前活动进度" :aria-valuenow="Math.round(progress)" :aria-valuemin="0" :aria-valuemax="100"><span :style="{ width: `${progress}%` }" /></div>
      <p class="current-rewards"><span>预计收获</span>{{ rewards(activity.rewards).join(' · ') }}</p>
      <p v-if="activity.kind === 'work'" class="current-cap">宠物币按领取当天的剩余额度结算。</p>
    </div>
    <p v-if="pets.pet.activity" class="occupied-note"><PetIcon :name="pets.pet.activity.kind === 'rest' ? 'rest' : 'clock'" />{{ occupiedText }}</p>

    <div v-if="pets.catalog" class="activity-tabs" role="tablist" aria-label="活动类型" @keydown="moveTab">
      <button v-for="item in tabs" :id="`pet-${item.id}-tab`" :key="item.id" type="button" role="tab" :aria-selected="tab === item.id" :tabindex="tab === item.id ? 0 : -1" aria-controls="pet-activity-options" @click="tab = item.id"><PetIcon :name="item.id" />{{ item.name }}<span>{{ item.id === 'outing' ? pets.catalog.places.length : item.id === 'course' ? pets.catalog.courses.length : pets.catalog.jobs.length }}</span></button>
    </div>
    <div v-if="tab === 'work' && pets.state" class="work-income"><div><PetIcon name="coin" /><span>今日工作收入</span><strong>{{ pets.state.income.earned }}<small> / {{ pets.state.income.limit }} 币</small></strong></div><p>所有兼职共享每日额度，按领取当天结算。</p></div>
    <div v-if="pets.catalog" id="pet-activity-options" class="activity-options" role="tabpanel" :aria-labelledby="`pet-${tab}-tab`">
      <article v-for="entry in entries" :key="`${tab}:${entry.id}`" class="activity-option">
        <header><h3>{{ entry.name }}</h3><span><PetIcon name="clock" />{{ petDuration(entry.durationMs) }}</span></header>
        <p class="activity-description">{{ entry.description }}</p>
        <p v-if="requirement(entry)" class="activity-requirement">需要{{ requirement(entry) }}</p>
        <div class="activity-rewards"><span class="detail-label">预计</span><p><span v-for="reward in rewards(entry.rewards)" :key="reward">{{ reward }}</span></p></div>
        <div class="activity-costs"><span class="detail-label">消耗</span><p><span>精力 {{ entry.cost.energy }}</span><span>饱食 {{ entry.cost.hunger }}</span><span>水分 {{ entry.cost.water }}</span></p></div>
        <footer><span class="activity-price"><PetIcon name="coin" /><b>{{ entry.cost.coins }}</b>宠物币</span><button type="button" :aria-label="`开始${entry.name}`" :disabled="locked || !!reason(entry)" :title="reason(entry) || `${entry.cost.coins ? `花费 ${entry.cost.coins} 宠物币，` : ''}开始${entry.name}`" @click="start(entry)">{{ tab === 'outing' ? '出发' : tab === 'work' ? '去工作' : '去上课' }}<span aria-hidden="true">↗</span></button></footer>
        <p v-if="!pets.pet.activity && reason(entry)" class="shortage">{{ reason(entry) }}</p>
      </article>
    </div>

    <section v-if="tab === 'work'" class="job-progress" aria-labelledby="pet-jobs-title"><header><h3 id="pet-jobs-title"><PetIcon name="work" />职业熟练度</h3><span>工作经历单独积累，不消耗已有技能</span></header><div class="jobs-grid"><div v-for="job in jobs" :key="job.id" class="pet-job"><header><span>{{ job.name }}</span><strong>{{ job.progress ? `Lv. ${job.progress.level}` : '—' }}</strong></header><p v-if="job.progress"><b>{{ job.progress.experience }}</b> 熟练度<span>完成 {{ job.progress.completed }} 次</span></p><p v-else>暂不可用</p></div></div></section>

    <section class="pet-skills" aria-labelledby="pet-skills-title"><header><h3 id="pet-skills-title"><PetIcon name="growth" />正在积累的本领</h3><span>每一点进步都记在这里</span></header><div class="skills-grid"><div v-for="skill in skills" :key="skill.id" class="pet-skill" :title="skill.description"><div><span>{{ skill.name }}</span><strong>{{ skill.progress ? `Lv. ${skill.progress.level}` : '—' }}</strong></div><span>{{ skill.progress ? `${skill.progress.experience} 经验` : '暂不可用' }}</span></div></div></section>
  </section>
</template>

<style scoped>
.pet-activities { margin-top: 20px; padding: 24px; border: 1px solid var(--fp-border); border-radius: var(--fp-panel-radius, 14px); color: var(--fp-text); background: var(--fp-card); scroll-margin-top: 100px; }
.activities-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 22px; }.activities-heading h2 { margin: 0; font-size: 19px; color: var(--fp-title); }.activities-heading p { margin: 8px 0 0; color: var(--fp-muted); font-size: 13px; line-height: 1.7; }.activities-heading > svg { width: 28px; height: 28px; color: var(--fp-primary); opacity: .7; }
.current-activity { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; padding: 20px; margin-bottom: 12px; border: 1px solid var(--fp-border); border-radius: 12px; background: var(--fp-bg); }.current-activity.claimable { background: var(--fp-primary-soft); border-color: color-mix(in srgb, var(--fp-primary) 25%, var(--fp-border)); }.current-icon { display: grid; place-items: center; width: 48px; height: 48px; flex: none; border-radius: 12px; color: var(--fp-primary); background: var(--fp-card); }.current-icon svg { width: 24px; height: 24px; }.current-copy { flex: 1; min-width: 120px; }.current-copy > span { color: var(--fp-muted); font-size: 11px; }.current-copy h3 { margin: 5px 0; color: var(--fp-title); font-size: 17px; }.current-copy p { margin: 0; font-size: 12px; color: var(--fp-muted); }.current-duration { display: flex; align-items: center; gap: 6px; color: var(--fp-muted); font-size: 12px; }.current-duration svg { width: 15px; height: 15px; }.activity-primary { min-height: 42px; padding: 10px 18px; border: 0; border-radius: 9px; background: var(--fp-primary); color: #fff; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.activity-progress { width: 100%; height: 5px; border-radius: 5px; background: var(--fp-border); overflow: hidden; }.activity-progress > span { display: block; height: 100%; background: var(--fp-primary); border-radius: inherit; transition: width 1s linear; }.current-rewards { flex-basis: 100%; margin: -4px 0 0; font-size: 12px; color: var(--fp-text); line-height: 1.8; }.current-rewards > span { color: var(--fp-muted); margin-right: 12px; }.occupied-note { display: flex; align-items: center; gap: 7px; margin: 12px 0 20px; color: var(--fp-muted); font-size: 12px; line-height: 1.6; }.occupied-note svg { width: 15px; height: 15px; }
.activity-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; width: min(100%, 350px); padding: 4px; border-radius: 10px; background: var(--fp-bg); margin-bottom: 16px; }.activity-tabs button { display: flex; align-items: center; justify-content: center; gap: 7px; min-width: 0; min-height: 38px; padding: 8px 12px; border: 1px solid transparent; border-radius: 7px; color: var(--fp-muted); background: transparent; font: inherit; font-size: 13px; cursor: pointer; }.activity-tabs button[aria-selected=true] { color: var(--fp-primary); background: var(--fp-card); border-color: var(--fp-border); }.activity-tabs svg { width: 17px; height: 17px; }.activity-tabs button > span { font-size: 11px; opacity: .75; }
.activity-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }.activity-option { display: flex; flex-direction: column; padding: 18px; border: 1px solid var(--fp-border); border-radius: 11px; background: var(--fp-card); min-width: 0; }.activity-option > header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }.activity-option h3 { color: var(--fp-title); margin: 0; font-size: 15px; }.activity-option > header > span { display: flex; align-items: center; gap: 4px; color: var(--fp-muted); font-size: 11px; white-space: nowrap; }.activity-option > header svg { width: 13px; height: 13px; }.activity-description { min-height: 40px; margin: 10px 0 16px; color: var(--fp-muted); font-size: 12px; line-height: 1.7; }
.detail-label { color: var(--fp-muted); font-size: 11px; }.activity-rewards, .activity-costs { display: flex; gap: 12px; align-items: flex-start; }.activity-rewards > span, .activity-costs > span { flex: none; line-height: 1.8; }.activity-rewards p, .activity-costs p { display: flex; flex-wrap: wrap; gap: 3px 10px; margin: 0; font-size: 11px; line-height: 1.8; }.activity-rewards { min-height: 40px; margin-bottom: 7px; }.activity-rewards p { color: var(--fp-primary); }.activity-costs p { color: var(--fp-muted); }.activity-option footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 16px; margin-top: auto; }.activity-price { display: flex; align-items: center; gap: 4px; color: var(--fp-muted); font-size: 11px; }.activity-price svg { color: var(--fp-accent); width: 15px; height: 15px; }.activity-price b { color: var(--fp-text); font-size: 14px; margin-right: 2px; }.activity-option footer button { display: flex; align-items: center; gap: 12px; min-height: 38px; padding: 8px 12px; border: 1px solid var(--fp-border); border-radius: 8px; color: var(--fp-primary); background: var(--fp-primary-soft); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; transition: border-color .16s, transform .16s; }.activity-option footer button:not(:disabled):hover { border-color: var(--fp-primary); transform: translateY(-1px); }.shortage { color: var(--fp-muted); font-size: 11px; margin: 8px 0 0; }
.pet-skills { border-top: 1px solid var(--fp-border); padding-top: 20px; margin-top: 24px; }.pet-skills > header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }.pet-skills h3 { display: flex; align-items: center; gap: 7px; color: var(--fp-title); font-size: 14px; margin: 0; }.pet-skills h3 svg { color: var(--fp-primary); width: 17px; height: 17px; }.pet-skills > header > span { color: var(--fp-muted); font-size: 11px; }.skills-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 16px; }.pet-skill > div { display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: 12px; margin-bottom: 6px; }.pet-skill strong { color: var(--fp-primary); font-size: 11px; font-weight: 500; white-space: nowrap; }.pet-skill > span { color: var(--fp-muted); font-size: 11px; }
.current-cap { flex-basis: 100%; margin: -10px 0 0; color: var(--fp-muted); font-size: 11px; }
.work-income { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px; margin: 0 0 16px; padding: 12px 14px; border-radius: 9px; background: var(--fp-bg); }.work-income > div { display: flex; align-items: center; gap: 7px; font-size: 12px; }.work-income svg { width: 17px; height: 17px; color: var(--fp-accent); }.work-income strong { font-size: 15px; font-variant-numeric: tabular-nums; }.work-income small { font-size: 11px; font-weight: 400; color: var(--fp-muted); }.work-income p { margin: 0; font-size: 11px; color: var(--fp-muted); line-height: 1.6; }
.activity-requirement { margin: -5px 0 12px; color: var(--fp-muted); font-size: 11px; line-height: 1.6; }
.job-progress { border-top: 1px solid var(--fp-border); padding-top: 20px; margin-top: 24px; }.job-progress > header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 16px; }.job-progress h3 { display: flex; align-items: center; gap: 7px; margin: 0; font-size: 14px; color: var(--fp-title); }.job-progress h3 svg { width: 17px; height: 17px; color: var(--fp-primary); }.job-progress > header > span { color: var(--fp-muted); font-size: 11px; }.jobs-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 24px; }.pet-job { padding: 10px 0; min-width: 0; }.pet-job header { display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: 12px; }.pet-job header strong { color: var(--fp-primary); font-size: 11px; font-weight: 500; white-space: nowrap; }.pet-job p { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px; margin: 7px 0 0; color: var(--fp-muted); font-size: 11px; }.pet-job p b { color: var(--fp-text); font-weight: 600; }.pet-job p > span { margin-left: auto; }
button:disabled { opacity: .45; cursor: default; }button:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
@media (max-width: 950px) { .activity-options { grid-template-columns: repeat(2, minmax(0, 1fr)); }.skills-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px 24px; } }
@media (max-width: 600px) { .pet-activities { padding: 20px; }.activity-options { grid-template-columns: 1fr; }.activity-description, .activity-rewards { min-height: 0; }.activity-description { margin-bottom: 12px; }.activity-option { padding: 16px; }.activity-option footer { padding-top: 14px; }.current-activity { padding: 16px; gap: 12px; }.current-icon { width: 40px; height: 40px; }.current-duration { flex-basis: 100%; }.activities-heading h2 { font-size: 18px; }.skills-grid { gap: 18px 16px; }.activity-tabs button { min-height: 44px; }.activity-option footer button, .activity-primary { min-height: 44px; } }
@media (max-width: 600px) { .jobs-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 18px; }.pet-job p > span { flex-basis: 100%; margin: 0; } }
@media (max-width: 390px) { .pet-activities { padding: 16px; }.current-activity .activity-primary { width: 100%; }.pet-skill > div { align-items: flex-start; flex-direction: column; gap: 3px; }.activity-tabs button { padding-inline: 6px; }.activity-tabs button > span, .activity-tabs button > svg { display: none; } }
@media (prefers-reduced-motion: reduce) { .activity-progress > span, .activity-option footer button { transition: none; } }
</style>
