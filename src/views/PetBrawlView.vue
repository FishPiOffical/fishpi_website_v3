<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getAuthContextVersion } from '@/api/http'
import { brawlSkillNames as skills, brawlWeaponNames as weapons, readBrawlHistory, readBrawlReport, readBrawlState, type BrawlProduct, type BrawlSkill, type BrawlSlot, type BrawlSummary, type BrawlWeapon } from '@/api/v3-pets'
import { petPortrait, type PetBattleAction } from '@/components/pets/animations'
import PetBrawlFighterVisual from '@/components/pets/PetBrawlFighterVisual.vue'
import { brawlWeaponVisuals } from '@/components/pets/brawlWeaponArt'
import PetFeedback from '@/components/pets/PetFeedback.vue'
import PetBrawlCheckout from '@/components/pets/PetBrawlCheckout.vue'
import PetBrawlSeason from '@/components/pets/PetBrawlSeason.vue'
import PetBrawlInvitations from '@/components/pets/PetBrawlInvitations.vue'
import PetBrawlWeaponArt from '@/components/pets/PetBrawlWeaponArt.vue'
import PetIcon from '@/components/pets/PetIcon.vue'
import { imageThumbnail } from '@/utils/avatar'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore } from '@/stores/pets'

usePageSeo(() => ({ title: '宠物乱斗', path: '/pets/brawl', robots: 'noindex' }))
const route = useRoute()
const auth = useAuthStore()
const pets = usePetsStore()
const state = ref<Awaited<ReturnType<typeof readBrawlState>>>()
const report = ref<Awaited<ReturnType<typeof readBrawlReport>>>()
const matches = ref<BrawlSummary[]>([])
const next = ref<string | null>(null)
const error = ref('')
const reportError = ref('')
const retryReport = ref<string>()
const status = ref('')
const loading = ref(false)
const historyLoading = ref(false)
const reportLoading = ref(false)
const weapon = ref<BrawlWeapon>('SPOON')
const skill = ref<BrawlSkill>('SPLASH')
const weaponPulse = ref<number>()
watch(weapon, () => { weaponPulse.value = undefined })
const stage = ref(1)
const section = ref<'arena' | 'friendly' | 'equipment' | 'season'>(route.query.tab === 'friendly' ? 'friendly' : 'arena')
watch(() => route.query.tab, name => { if (name === 'friendly') section.value = 'friendly' })
const sectionTabs = ref<HTMLElement | null>(null)
const battleMode = ref<'pvp' | 'npc'>('pvp')
const sections = [
  { id: 'arena', label: '对战大厅', icon: 'play' },
  { id: 'friendly', label: '好友约战', icon: 'care' },
  { id: 'equipment', label: '配装工坊', icon: 'craft' },
  { id: 'season', label: '赛季榜单', icon: 'collection' },
] as const
const speciesNames: Record<string, string> = { momota: '摸摸獭', hexiaotun: '荷小豚', yubingmiao: '鱼饼喵', paixiaoyu: '派小鱼' }
const petName = computed(() => {
  const pet = pets.pet
  return pet && pet.id === state.value?.petId ? pet.name : speciesNames[state.value?.species ?? ''] ?? '我的宠物'
})
const portrait = (species: string | null | undefined, size = 160) => {
  const source = species ? petPortrait(species) : undefined
  return source ? imageThumbnail(source, size, size) : undefined
}
const petProfileRoute = (petId: string) => ({ name: 'ranked-pet-profile', params: { petId } })
const frame = ref(0)
const playing = ref(false)
const contactReached = ref(false)
const compact = ref(true)
const saveData = ref(false)
const stillReplay = computed(() => compact.value || saveData.value)
let connection: (EventTarget & { saveData?: boolean }) | undefined
const fighters = ref<HTMLElement | null>(null)
const playbackKey = ref(0)
const stepDuration = 1000
const contactTime = stepDuration / 2
let deadline = 0
let remaining = stepDuration
let compactQuery: MediaQueryList | undefined
let mounted = false
let timer: ReturnType<typeof setTimeout> | undefined
let stateRequest: AbortController | undefined
let historyRequest: AbortController | undefined
let reportRequest: AbortController | undefined
const equipmentGroups = [{ exclusive: false, label: '通用' }, { exclusive: true, label: '宠物专属' }] as const
const equipment = computed(() => state.value?.equipmentCatalog)
const selectedWeapon = computed(() => equipment.value?.weapons.find(item => item.id === weapon.value))
const selectedSkill = computed(() => equipment.value?.skills.find(item => item.id === skill.value))
const opponents = ['水花练习生', '护腕学徒', '折扇教练']
const dateTime = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Shanghai' })
const eligible = computed(() => !!state.value?.petId && state.value.level >= state.value.minLevel)
const locked = computed(() => loading.value || !!error.value || pets.busy || !!pets.pending || pets.offline)
const pvpDirty = computed(() => !!state.value?.pvp?.enabled &&
  (state.value.pvp.weapon !== weapon.value || state.value.pvp.skill !== skill.value))
const level = computed(() => state.value?.levels[weapon.value] ?? 0)
const maxUpgrade = computed(() => state.value?.maxUpgrade ?? 20)
const milestones = computed(() => Array.from({ length: 6 }, (_, index) => index * maxUpgrade.value / 5))
const growth = computed(() => state.value?.growth[level.value])
const nextGrowth = computed(() => state.value?.growth[level.value + 1])
const selectedGear = computed(() => state.value?.gear?.weapons[weapon.value])
const gearOptions = computed(() => {
  if (!selectedGear.value || !state.value?.gear) return []
  const current = selectedGear.value
  return state.value.gear.catalog.map(item => {
    const rank = item.id === 'ARTIFACT' ? current.artifact : item.id === 'SLOT' ? current.slot : item.rank
    const cost = item.id === 'ARTIFACT' && level.value < maxUpgrade.value ? undefined : item.costs[rank]
    return { id: item.id, name: item.name, level: rank, cost, hp: item.hp, attack: item.attack }
  })
})
const socketDraft = ref<Record<BrawlSlot, BrawlProduct | ''>>({ soul: '', rune: '' })
watch(selectedGear, set => { socketDraft.value = { soul: set?.soul ?? '', rune: set?.rune ?? '' } }, { immediate: true })
const ownedSocketItems = (slot: BrawlSlot) => state.value?.gear?.catalog.filter(item =>
  item.rank > 0 && item.id.startsWith(slot === 'soul' ? 'SOUL_' : 'RUNE_')) ?? []
async function socket(slot: BrawlSlot) {
  const current = state.value
  if (locked.value || !current?.petId || !current.gear || !selectedGear.value ||
      (slot === 'rune' && !selectedGear.value.slot) || socketDraft.value[slot] === selectedGear.value[slot]) return
  const confirmed = await pets.executeBrawl({ kind: 'brawl-socket', petId: current.petId, version: current.version,
    revision: current.gear.revision, weapon: weapon.value, slot, item: socketDraft.value[slot] })
  if (!confirmed && !pets.pending && mounted && state.value?.petId === current.petId && pets.error) void refresh()
}
const cost = computed(() => state.value?.costs[level.value])
const turn = computed(() => {
  const turns = report.value?.turns
  return turns?.[Math.min(frame.value, turns.length) - 1]
})
const ended = computed(() => !!report.value && frame.value > report.value.turns.length)
const hp = (centi: number) => (centi / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
const settled = computed(() => contactReached.value || stillReplay.value || ended.value)
const hpTurn = computed(() => settled.value ? turn.value : report.value?.turns[frame.value - 2])
const turnFeedback = computed(() => {
  if (!turn.value || !settled.value || ended.value) return []
  const { actor, damage, healing } = turn.value
  const received = { kind: turn.value.effects?.criticalBonus ? 'critical' : 'damage', text: `−${hp(damage)}` }
  const restored = healing > 0 ? { kind: 'heal', text: `+${hp(healing)}` } : undefined
  return actor === 0 ? [restored, received] : [received, restored]
})
type BattleTurn = NonNullable<typeof turn.value>
function effectNotes(event: BattleTurn, detail = false) {
  const data = report.value
  const effects = event.effects
  if (!data || !effects) return []
  const attacker = event.actor === 0 ? data.player : data.opponent
  const defender = event.actor === 0 ? data.opponent : data.player
  return [
    { text: '基础伤害', amount: detail ? effects.baseDamage : 0, sign: '' },
    { text: '暴击', amount: effects.criticalBonus, sign: '+' },
    { text: weapons[attacker.weapon], amount: effects.weaponBonus, sign: '+' },
    { text: skills[attacker.skill], amount: effects.skillBonus, sign: '+' },
    { text: `${weapons[attacker.weapon]}追击`, amount: effects.followUp, sign: '+' },
    { text: `${weapons[defender.weapon]}减伤`, amount: effects.weaponGuard, sign: '−' },
    { text: `${skills[defender.skill]}减伤`, amount: effects.skillGuard, sign: '−' },
    { text: '穿透减伤', amount: effects.penetrated, sign: '+' },
    { text: '最低伤害补正', amount: effects.minimumBonus, sign: '+' },
    { text: `${skills[attacker.skill]}回血`, amount: event.healing, sign: '+' },
  ].filter(note => note.amount > 0)
}
const replayNotes = computed(() => turn.value && settled.value && !ended.value ? effectNotes(turn.value) : [])
const turnKey = computed(() => `${report.value?.id}:${playbackKey.value}:${frame.value}`)
const attackingFighter = computed(() => {
  if (!turn.value || !report.value || ended.value) return
  return turn.value.actor === 0 ? report.value.player : report.value.opponent
})
const projectile = computed(() => {
  if (stillReplay.value || !attackingFighter.value) return
  const visual = brawlWeaponVisuals[attackingFighter.value.weapon]
  if (visual.motion === 'cast' || visual.motion === 'throw') return visual
})
function battleAction(side: number): PetBattleAction | undefined {
  if (ended.value) {
    const winner = report.value?.winner
    if (winner == null || winner < 0) return
    return winner === side ? 'victory' : 'defeat'
  }
  return turn.value ? turn.value.actor === side ? 'attack' : 'hit' : undefined
}
const resultLabel = (winner: number) => winner === 0 ? '胜利' : winner === 1 ? '落败' : '平局'
const turnLabel = computed(() => {
  if (ended.value && report.value) {
    const result = resultLabel(report.value.winner)
    return report.value.mode !== 'npc' ? result : `${result} · 获得 ${report.value.reward} 材料`
  }
  if (!turn.value) return '准备开战'
  const { round, actor, damage, healing } = turn.value
  const subject = `第 ${round} 回合 · ${actor === 0 ? '我方' : '对手'}`
  if (!settled.value) return `${subject}出招`
  const recovery = healing ? `，回复 ${hp(healing)} 生命` : ''
  return `${subject}造成 ${hp(damage)} 伤害${recovery}`
})
const describe = (reason: unknown) => reason instanceof Error ? reason.message : '读取失败，请重试'

async function refresh() {
  stateRequest?.abort()
  const request = new AbortController()
  stateRequest = request
  loading.value = true
  error.value = ''
  try {
    const result = await readBrawlState(request.signal)
    if (request.signal.aborted) return
    if (state.value && state.value.petId !== result.petId) {
      reportRequest?.abort()
      reportLoading.value = false
      stop()
      report.value = undefined
      stage.value = 1
    }
    const changedPet = state.value?.petId !== result.petId
    state.value = result
    if (changedPet && result.pvp) {
      weapon.value = result.pvp.weapon ?? result.pvp.friendlyWeapon ?? 'SPOON'
      skill.value = result.pvp.skill ?? result.pvp.friendlySkill ?? 'SPLASH'
    }
    if (!result.equipmentCatalog.weapons.some(item => item.id === weapon.value)) weapon.value = 'SPOON'
    if (!result.equipmentCatalog.skills.some(item => item.id === skill.value)) skill.value = 'SPLASH'
    return state.value
  } catch (reason) {
    if (!request.signal.aborted) error.value = describe(reason)
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}

async function loadHistory(before?: string) {
  historyRequest?.abort()
  const request = new AbortController()
  historyRequest = request
  historyLoading.value = true
  reportError.value = ''
  try {
    const result = await readBrawlHistory(before, request.signal)
    if (request.signal.aborted) return
    matches.value = before ? [...matches.value, ...result.list] : result.list
    next.value = result.next
  } catch (reason) {
    if (!request.signal.aborted) reportError.value = describe(reason)
  } finally {
    if (!request.signal.aborted) historyLoading.value = false
  }
}

async function openReport(id: string, autoplay = false) {
  reportRequest?.abort()
  const request = new AbortController()
  reportRequest = request
  reportLoading.value = true
  reportError.value = ''
  retryReport.value = id
  stop()
  try {
    const result = await readBrawlReport(id, request.signal)
    if (request.signal.aborted) return
    report.value = result
    frame.value = autoplay ? 0 : result.turns.length + 1
    remaining = stepDuration
    retryReport.value = undefined
    if (autoplay && section.value === 'arena' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) play()
    else skip()
  } catch (reason) {
    if (!request.signal.aborted) reportError.value = describe(reason)
  } finally {
    if (!request.signal.aborted) reportLoading.value = false
  }
}

function stop() {
  clearTimeout(timer)
  if (playing.value) remaining = Math.max(0, deadline - performance.now())
  playing.value = false
}
function skip() {
  stop()
  if (!report.value) return
  frame.value = report.value.turns.length + 1
  status.value = resultLabel(report.value.winner)
}
function play() {
  if (!report.value || playing.value || section.value !== 'arena') return
  if (frame.value === 0 || ended.value) {
    playbackKey.value++
    frame.value = 1
    contactReached.value = false
    remaining = stepDuration
  }
  playing.value = true
  void nextTick(() => {
    if (!playing.value) return
    const bounds = fighters.value?.getBoundingClientRect()
    if (bounds && (bounds.top < 64 || bounds.bottom > window.innerHeight)) {
      fighters.value?.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  })
  scheduleStep()
}
function finishStep() {
  if (!report.value || !playing.value) return
  if (ended.value) {
    stop()
    status.value = resultLabel(report.value.winner)
    return
  }
  frame.value++
  contactReached.value = false
  if (ended.value && report.value.winner < 0) {
    skip()
    return
  }
  remaining = stepDuration
  scheduleStep()
}
function scheduleStep() {
  deadline = performance.now() + remaining
  if (!ended.value && !contactReached.value) {
    // 暂停和继续沿用本回合剩余时间，命中和生命值只在同一个时间点更新。
    const untilContact = remaining - (stepDuration - contactTime)
    if (untilContact > 0) {
      timer = setTimeout(() => {
        if (!playing.value) return
        contactReached.value = true
        timer = setTimeout(finishStep, Math.max(0, deadline - performance.now()))
      }, untilContact)
      return
    }
    contactReached.value = true
  }
  timer = setTimeout(finishStep, remaining)
}
function updateCompact() { compact.value = compactQuery?.matches ?? true }
function updateSaveData() { saveData.value = connection?.saveData === true }
function pauseWhenHidden() { if (document.hidden) stop() }
watch(section, value => { if (value !== 'arena') stop() })
async function selectSection(value: typeof section.value) {
  section.value = value
  await nextTick()
  if (mounted && section.value === value) sectionTabs.value?.querySelector<HTMLButtonElement>(`#brawl-tab-${value}`)?.focus({ preventScroll: true })
}
function navigateSection(event: KeyboardEvent) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (!keys.includes(event.key)) return
  event.preventDefault()
  const index = sections.findIndex(item => item.id === section.value)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + sections.length) % sections.length
  section.value = sections[next]!.id
  ;(event.currentTarget as HTMLElement).querySelector<HTMLButtonElement>(`#brawl-tab-${section.value}`)?.focus()
}
async function viewReport(id: string) {
  const context = getAuthContextVersion()
  const owner = auth.account?.oId
  section.value = 'arena'
  await nextTick()
  if (!mounted || !auth.isLoggedIn || context !== getAuthContextVersion() || owner !== auth.account?.oId) return
  fighters.value?.closest('section')?.scrollIntoView({ block: 'start', behavior: 'instant' })
  await openReport(id)
}
function fight(practice: boolean) {
  if (locked.value || !eligible.value || !state.value?.petId || (!practice && stage.value > state.value.unlocked)) return
  status.value = ''
  void pets.executeBrawl({ kind: 'brawl-fight', petId: state.value.petId, version: state.value.version,
    weapon: weapon.value, skill: skill.value, stage: stage.value, practice })
}
async function upgrade() {
  if (locked.value || !eligible.value || !state.value?.petId || !cost.value || state.value.materials < cost.value) return
  status.value = ''
  const id = state.value.petId
  const confirmed = await pets.executeBrawl({ kind: 'brawl-upgrade', petId: id, version: state.value.version,
    weapon: weapon.value, level: level.value })
  if (!confirmed && mounted && state.value?.petId === id && !pets.pending && pets.error) void refresh()
}

async function pvpAction(action: 'enroll' | 'withdraw' | 'match' | 'save') {
  const current = state.value
  if (locked.value || !eligible.value || !current?.petId || !current.pvp) return
  if (action === 'match' && (!current.pvp.enabled || !current.pvp.remaining || pvpDirty.value)) return
  const input = { petId: current.petId, version: current.version, revision: current.pvp.revision }
  status.value = ''
  const ok = await pets.executeBrawl(action === 'match' ? { ...input, kind: 'brawl-match' } : {
    ...input, kind: 'brawl-enroll', enabled: action === 'enroll' || (action === 'save' && current.pvp.enabled), weapon: weapon.value, skill: skill.value,
  })
  if (!ok && mounted && state.value?.petId === input.petId && !pets.pending && pets.error) void refresh()
}

watch(() => pets.confirmedEvent, event => {
  if (!mounted || !event) return
  if ((event.kind === 'brawl-fight' || event.kind === 'brawl-match') && event.matchId) {
    void refresh()
    void loadHistory()
    void openReport(event.matchId, true)
  }
  if (event.kind === 'brawl-invite-decision' && event.matchId) {
    void loadHistory()
    if (section.value === 'friendly') void viewReport(event.matchId)
  }
  if (event.kind === 'brawl-enroll') {
    status.value = '出战配装已保存'
    void refresh()
  }
  if (event.kind === 'brawl-socket') {
    status.value = '镶嵌配置已保存'
    void refresh()
  }
  if (event.kind === 'brawl-season-claim') void refresh()
  if (event.kind === 'brawl-upgrade' || event.kind === 'brawl-confirm') {
    status.value = '强化完成'
    void refresh().then(fresh => {
      const upgrade = event.upgrade
      if (upgrade && fresh && fresh.petId === event.petId && state.value === fresh &&
          weapon.value === upgrade.weapon && fresh.levels[upgrade.weapon] === upgrade.previousLevel + 1)
        weaponPulse.value = event.sequence
    })
  }
})
function clear() {
  stateRequest?.abort()
  historyRequest?.abort()
  reportRequest?.abort()
  stop()
  state.value = report.value = undefined
  retryReport.value = undefined
  matches.value = []
  next.value = null
  status.value = error.value = reportError.value = ''
  weaponPulse.value = undefined
  loading.value = historyLoading.value = reportLoading.value = false
  section.value = route.query.tab === 'friendly' ? 'friendly' : 'arena'
  battleMode.value = 'pvp'
  weapon.value = 'SPOON'
  skill.value = 'SPLASH'
  stage.value = 1
}
function initialize() {
  if (!auth.isLoggedIn) return
  void refresh()
  void loadHistory()
  if (pets.confirmedEvent?.matchId) void openReport(pets.confirmedEvent.matchId)
}
let boundary = getAuthContextVersion()
watch([() => auth.accessToken, () => auth.account?.oId], ([token, owner], [, oldOwner]) => {
  const context = getAuthContextVersion()
  if (!token || owner !== oldOwner || context !== boundary) {
    clear()
    boundary = context
    if (mounted) initialize()
  }
}, { flush: 'sync' })
onMounted(() => {
  mounted = true
  compactQuery = window.matchMedia('(max-width: 720px), (hover: none) and (pointer: coarse), (prefers-reduced-motion: reduce)')
  compactQuery.addEventListener('change', updateCompact)
  connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection
  connection?.addEventListener('change', updateSaveData)
  updateSaveData()
  document.addEventListener('visibilitychange', pauseWhenHidden)
  updateCompact()
  initialize()
})
onUnmounted(() => {
  mounted = false
  compactQuery?.removeEventListener('change', updateCompact)
  connection?.removeEventListener('change', updateSaveData)
  document.removeEventListener('visibilitychange', pauseWhenHidden)
  clear()
})
</script>

<template>
  <main class="fp-page fp-page--wide fp-ui brawl-page" :data-brawl-ready="state ? 'true' : undefined">
    <header class="heading">
      <div class="heading-copy"><RouterLink class="back-link" to="/pets"><PetIcon name="home" />宠物家园<PetIcon name="chevron" /></RouterLink><h1>宠物乱斗</h1></div>
      <button type="button" class="refresh-button" :disabled="loading || historyLoading" @click="refresh(); loadHistory()"><PetIcon name="refresh" />刷新进度</button>
    </header>
    <PetFeedback />
    <p v-if="loading && !state" class="panel loading-state" role="status">正在读取乱斗进度…</p>
    <div v-if="error" class="panel error-state"><p role="alert">{{ error }}</p><button type="button" @click="refresh()">重新读取进度</button></div>
    <template v-if="state">
      <section class="brawl-overview" aria-label="宠物乱斗进度">
        <div class="pet-identity">
          <img v-if="portrait(state.species, 88)" :src="portrait(state.species, 88)" width="88" height="88" alt="" />
          <span v-else class="pet-placeholder"><PetIcon name="pet" /></span>
          <div><span class="eyebrow">{{ eligible ? '准备出战' : '成长进行中' }}</span><h2>{{ state.petId ? petName : '还没有宠物' }}<span v-if="state.petId" class="level-tag">Lv.{{ state.level }}</span></h2><p>{{ eligible ? '闯关积累材料，配装挑战对手。' : `宠物达到 Lv.${state.minLevel} 后开启对战。` }}</p></div>
        </div>
        <dl class="overview-stats">
          <div><dt><PetIcon name="material" />历练材料</dt><dd>{{ state.materials.toLocaleString() }}</dd></div>
          <div><dt><PetIcon name="outing" />闯关进度</dt><dd>{{ state.cleared }}<small> / {{ state.stages }} 关</small></dd></div>
          <div><dt><PetIcon name="gift" />今日闯关奖励</dt><dd>{{ state.rewardCount }}<small> / {{ state.rewards.length }} 场</small></dd></div>
        </dl>
      </section>
      <section v-if="!eligible" class="panel unlock-panel">
        <span class="unlock-symbol"><PetIcon name="lock" /></span>
        <div><h2>Lv.{{ state.minLevel }} 解锁乱斗</h2><p class="subtle">{{ state.petId ? '照顾宠物、参加课程和外出活动，继续积累成长经验。' : '先领养一只伙伴，再一起开启乱斗旅程。' }}</p></div>
        <RouterLink class="button-link" to="/pets">{{ state.petId ? '回家继续成长' : '前往领养' }}<PetIcon name="chevron" /></RouterLink>
      </section>
      <div ref="sectionTabs" class="section-tabs" role="tablist" aria-label="乱斗分区" @keydown="navigateSection">
        <button v-for="item in sections" :id="`brawl-tab-${item.id}`" :key="item.id" type="button" role="tab"
          :aria-selected="section === item.id" :aria-controls="`brawl-panel-${item.id}`" :tabindex="section === item.id ? 0 : -1"
          @click="selectSection(item.id)"><PetIcon :name="item.icon" />{{ item.label }}</button>
      </div>
      <div id="brawl-panel-arena" v-show="section === 'arena'" class="section-content" role="tabpanel" aria-labelledby="brawl-tab-arena" tabindex="0">
        <div class="arena" :class="{ single: !eligible }">
          <section class="panel battle" aria-labelledby="battle-heading">
            <div class="panel-heading"><h2 id="battle-heading"><PetIcon name="play" />对局回放</h2><span v-if="report" class="subtle">{{ report.mode === 'friendly' ? '好友约战' : report.mode === 'pvp' ? report.season ? `第 ${report.season} 赛季` : '实装对战' : report.practice ? '陪练' : `第 ${report.stage} 关` }}</span><span v-else class="subtle">等待开场</span></div>
            <p v-if="reportLoading" role="status" class="subtle">正在读取战报…</p>
            <p v-if="reportError && retryReport" role="alert" class="error-state">{{ reportError }} <button type="button" @click="openReport(retryReport)">重读战报</button></p>
            <div ref="fighters" class="battle-stage">
              <template v-if="report">
                <div class="fighters">
                  <div class="fighter">
                    <span class="fighter-side">我方</span>
                    <div class="fighter-identity">
                      <RouterLink class="fighter-pet" :to="petProfileRoute(report.petId)">
                        <PetBrawlFighterVisual :species="report.species" :action="battleAction(0)"
                          :weapon="(attackingFighter ?? report.player).weapon" :level="(attackingFighter ?? report.player).level"
                          :artifact="(attackingFighter ?? report.player).artifact" :max-level="report.maxUpgrade"
                          :turn-key="turnKey" :duration="stepDuration" :playing="playing" :still="stillReplay" />
                        <span v-if="turnFeedback[0]" :key="turnKey" class="combat-number" :data-kind="turnFeedback[0].kind"
                          :class="{ 'is-static': stillReplay }" :style="{ animationPlayState: playing ? 'running' : 'paused' }"
                          aria-hidden="true">{{ turnFeedback[0].text }}</span>
                        <strong>{{ report.player.petName ?? '我的宠物' }}</strong>
                      </RouterLink>
                      <span v-if="report.player.ownerNickname">{{ report.player.ownerNickname }}</span>
                    </div>
                    <span class="fighter-weapon">
                      <PetBrawlWeaponArt :weapon="report.player.weapon" :level="report.player.level" :max-level="report.maxUpgrade" :artifact="report.player.artifact" size="battle" />
                      <span><strong>{{ weapons[report.player.weapon] }} +{{ report.player.level }}</strong><small>{{ skills[report.player.skill] }}</small></span>
                    </span>
                    <span v-if="report.player.gearHp || report.player.gearAttack">配装 生命 +{{ hp(report.player.gearHp) }} · 伤害 +{{ hp(report.player.gearAttack) }}</span>
                    <progress aria-label="我的宠物生命" :max="report.player.maxHp" :value="hpTurn?.playerHp ?? report.player.maxHp" />
                    <span>{{ hp(hpTurn?.playerHp ?? report.player.maxHp) }} / {{ hp(report.player.maxHp) }}</span>
                  </div>
                  <span class="versus" aria-hidden="true">VS</span>
                  <div class="fighter">
                    <span class="fighter-side opponent">对手</span>
                    <div class="fighter-identity">
                      <component :is="report.opponentPetId ? RouterLink : 'div'" class="fighter-pet"
                        :to="report.opponentPetId ? petProfileRoute(report.opponentPetId) : undefined">
                        <PetBrawlFighterVisual :species="report.opponentSpecies ?? 'momota'" :action="battleAction(1)"
                          :weapon="(attackingFighter ?? report.opponent).weapon" :level="(attackingFighter ?? report.opponent).level"
                          :artifact="(attackingFighter ?? report.opponent).artifact" :max-level="report.maxUpgrade"
                          :turn-key="turnKey" :duration="stepDuration" :playing="playing" :still="stillReplay" mirrored />
                        <span v-if="turnFeedback[1]" :key="turnKey" class="combat-number" :data-kind="turnFeedback[1].kind"
                          :class="{ 'is-static': stillReplay }" :style="{ animationPlayState: playing ? 'running' : 'paused' }"
                          aria-hidden="true">{{ turnFeedback[1].text }}</span>
                        <strong>{{ report.mode !== 'npc' ? report.opponent.petName ?? '对手宠物' : opponents[report.stage - 1] }}</strong>
                      </component>
                      <span v-if="report.opponent.ownerNickname">{{ report.opponent.ownerNickname }}</span>
                    </div>
                    <span class="fighter-weapon">
                      <PetBrawlWeaponArt :weapon="report.opponent.weapon" :level="report.opponent.level" :max-level="report.maxUpgrade" :artifact="report.opponent.artifact" size="battle" />
                      <span><strong>{{ weapons[report.opponent.weapon] }} +{{ report.opponent.level }}</strong><small>{{ skills[report.opponent.skill] }}</small></span>
                    </span>
                    <span v-if="report.opponent.gearHp || report.opponent.gearAttack">配装 生命 +{{ hp(report.opponent.gearHp) }} · 伤害 +{{ hp(report.opponent.gearAttack) }}</span>
                    <progress aria-label="对手生命" :max="report.opponent.maxHp" :value="hpTurn?.opponentHp ?? report.opponent.maxHp" />
                    <span>{{ hp(hpTurn?.opponentHp ?? report.opponent.maxHp) }} / {{ hp(report.opponent.maxHp) }}</span>
                  </div>
                  <div v-if="projectile" :key="turnKey" class="projectile-lane" :class="{ reversed: turn?.actor === 1 }"
                    :data-projectile="projectile.art"
                    :style="{ '--shot-tone': projectile.tone, '--shot-duration': `${stepDuration}ms`, '--shot-play-state': playing ? 'running' : 'paused' }"
                    aria-hidden="true">
                    <span><img v-if="projectile.art === 'pebble'" src="/images/pets/weapons/pebble.png" alt="" width="26" height="26" /></span>
                  </div>
                </div>
                <div class="turn-readout" :class="{ 'has-effects': !ended && !!turn?.effects }">
                  <p class="turn" :class="{ 'is-ended': ended }">{{ turnLabel }}</p>
                  <ul v-if="replayNotes.length" class="effect-notes" aria-label="本次行动效果">
                    <li v-for="note in replayNotes" :key="note.text">{{ note.text }} <b>{{ note.sign }}{{ hp(note.amount) }}</b></li>
                  </ul>
                </div>
              </template>
              <div v-else class="stage-empty">
                <img v-if="portrait(state.species)" :src="portrait(state.species)" width="160" height="160" alt="" />
                <PetIcon v-else name="play" />
                <h3>{{ eligible ? '准备好，开始第一场较量' : '未来的对手在这里等你' }}</h3>
                <p>{{ eligible ? '选择玩家对战，或从闯关陪练开始。' : `达到 Lv.${state.minLevel} 后即可参加。` }}</p>
              </div>
            </div>
            <div v-if="report" class="replay-controls" data-floating-obstacle><span class="subtle">{{ ended ? '对局已结束' : `回合 ${turn?.round ?? 0} / ${report.turns[report.turns.length - 1]?.round}` }}</span><div class="actions"><button type="button" :disabled="reportLoading" @click="playing ? stop() : play()"><PetIcon :name="playing ? 'rest' : 'refresh'" />{{ playing ? '暂停' : ended ? '重播' : '继续' }}</button><button type="button" :disabled="reportLoading || (ended && !playing)" @click="skip()">跳过</button></div></div>
            <details v-if="report && ended" class="turn-details">
              <summary>逐回合战报</summary>
              <ol>
                <li v-for="(event, index) in report.turns" :key="index">
                  第 {{ event.round }} 回合 · {{ event.actor === 0 ? '我方' : '对手' }}造成 {{ hp(event.damage) }} 伤害<span v-if="event.healing">，回复 {{ hp(event.healing) }} 生命</span>
                  <ul v-if="event.effects" class="effect-notes" aria-label="伤害与回血明细">
                    <li v-for="note in effectNotes(event, true)" :key="note.text">{{ note.text }} <b>{{ note.sign }}{{ hp(note.amount) }}</b></li>
                  </ul>
                </li>
              </ol>
            </details>
          </section>
          <section v-if="eligible" class="panel battle-controls" data-floating-obstacle aria-label="出战操作">
            <div class="mode-switch" aria-label="对战方式"><button v-if="state.pvp" type="button" :aria-pressed="battleMode === 'pvp'" @click="battleMode = 'pvp'">玩家对战</button><button type="button" :aria-pressed="battleMode === 'npc' || !state.pvp" @click="battleMode = 'npc'">闯关陪练</button></div>
            <div class="loadout-heading"><h3>本次出战配置</h3><button type="button" class="text-button" @click="selectSection('equipment')">调整配装<PetIcon name="chevron" /></button></div>
            <div class="fields quick-fields">
              <div class="equipment-field">
                <label for="brawl-arena-weapon">武器</label>
                <select id="brawl-arena-weapon" v-model="weapon" :disabled="locked"
                  :aria-describedby="selectedWeapon?.effect ? 'brawl-arena-weapon-effect' : undefined">
                  <template v-for="group in equipmentGroups" :key="group.label">
                    <optgroup v-if="equipment?.weapons.some(item => item.exclusive === group.exclusive)" :label="group.label">
                      <option v-for="item in equipment.weapons.filter(item => item.exclusive === group.exclusive)" :key="item.id" :value="item.id">
                        {{ item.name }} +{{ state.levels[item.id] }}
                      </option>
                    </optgroup>
                  </template>
                </select>
                <small v-if="selectedWeapon?.effect" id="brawl-arena-weapon-effect">{{ selectedWeapon.effect }}</small>
              </div>
              <div class="equipment-field">
                <label for="brawl-arena-skill">招式</label>
                <select id="brawl-arena-skill" v-model="skill" :disabled="locked"
                  :aria-describedby="selectedSkill?.effect ? 'brawl-arena-skill-effect' : undefined">
                  <template v-for="group in equipmentGroups" :key="group.label">
                    <optgroup v-if="equipment?.skills.some(item => item.exclusive === group.exclusive)" :label="group.label">
                      <option v-for="item in equipment.skills.filter(item => item.exclusive === group.exclusive)" :key="item.id" :value="item.id">{{ item.name }}</option>
                    </optgroup>
                  </template>
                </select>
                <small v-if="selectedSkill?.effect" id="brawl-arena-skill-effect">{{ selectedSkill.effect }}</small>
              </div>
            </div>
            <dl v-if="growth" class="combat-stats"><div><dt>生命</dt><dd>{{ hp(growth.maxHp + (selectedGear?.hp ?? 0)) }}</dd></div><div><dt>基础伤害</dt><dd>{{ hp(growth.attack + (selectedGear?.attack ?? 0)) }}</dd></div></dl>
            <template v-if="state.pvp && battleMode === 'pvp'">
              <div class="pvp-summary"><span class="registration" :class="{ ready: state.pvp.enabled }">{{ state.pvp.enabled ? '已报名' : '未报名' }}</span><span>今日可挑战 <strong>{{ state.pvp.remaining }}</strong> 场</span></div>
              <p class="subtle">报名后，离线也能接受挑战。对战使用已报名的武器与招式。</p>
              <p v-if="pvpDirty" class="config-notice" role="status">配置已调整，保存后即可匹配。</p>
              <div class="match-actions">
                <button v-if="!state.pvp.enabled || pvpDirty" type="button" :class="{ primary: !state.pvp.enabled || pvpDirty }" :disabled="locked" @click="pvpAction('enroll')">{{ state.pvp.enabled ? '保存对战配置' : '报名接受匹配' }}</button>
                <button type="button" class="primary" :disabled="locked || !state.pvp.enabled || !state.pvp.remaining || pvpDirty" @click="pvpAction('match')"><PetIcon name="play" />寻找对手</button>
              </div>
              <div class="control-footer"><span>今日被挑战 {{ state.pvp.received }} / {{ state.pvp.receivedLimit }}</span><button v-if="state.pvp.enabled" type="button" class="text-button" :disabled="locked" @click="pvpAction('withdraw')">退出报名</button></div>
            </template>
            <template v-else>
              <label class="stage-label">挑战关卡<select v-model.number="stage" :disabled="locked"><option v-for="item in state.stages" :key="item" :value="item">第 {{ item }} 关 · {{ opponents[item - 1] }}{{ item <= state.cleared ? '（已通关）' : item > state.unlocked ? '（仅陪练）' : '' }}</option></select></label>
              <p class="reward-note"><PetIcon name="gift" />{{ state.rewards[state.rewardCount] ? `下场闯关奖励 ${state.rewards[state.rewardCount]} 材料` : '今日闯关材料已领完' }}</p>
              <div class="match-actions"><button type="button" :disabled="locked" @click="fight(true)">开始陪练</button><button type="button" class="primary" :disabled="locked || stage > state.unlocked" @click="fight(false)">开始闯关</button></div>
              <p class="subtle control-footer">{{ stage > state.unlocked ? '通关前一关后解锁；当前仍可陪练。' : `已通关 ${state.cleared} / ${state.stages} 关` }}</p>
            </template>
          </section>
        </div>
        <section class="panel history" aria-labelledby="history-heading">
          <div class="panel-heading"><h2 id="history-heading"><PetIcon name="history" />我的战报</h2><button type="button" class="text-button" :disabled="historyLoading" @click="loadHistory()"><PetIcon name="refresh" />刷新战报</button></div>
          <p v-if="reportError && !retryReport" role="alert">{{ reportError }}</p>
          <p v-if="historyLoading" role="status" class="subtle">正在读取战报列表…</p>
          <p v-if="!matches.length && !historyLoading && !reportError" class="empty-history">还没有战报，完成对局后会记录在这里。</p>
          <ul v-if="matches.length">
            <li v-for="match in matches" :key="match.id" :class="{ selected: report?.id === match.id }">
              <button type="button" class="match-replay" :disabled="reportLoading"
                :aria-label="`查看回放 · ${resultLabel(match.winner)} · ${match.opponentPetName ?? dateTime.format(match.createdAt)}`"
                @click="viewReport(match.id)" />
              <span class="result-mark" :class="{ win: match.winner === 0, loss: match.winner === 1 }">{{ resultLabel(match.winner) }}</span>
              <div class="match-title">
                <RouterLink v-if="match.opponentPetId" class="match-pet"
                  :to="petProfileRoute(match.opponentPetId)">
                  <img v-if="portrait(match.opponentSpecies, 36)" :src="portrait(match.opponentSpecies, 36)"
                    alt="" width="36" height="36" loading="lazy" />
                  <strong>{{ match.opponentPetName || speciesNames[match.opponentSpecies ?? ''] || '对手宠物' }}</strong>
                </RouterLink>
                <strong v-else-if="match.opponentPetName">{{ match.opponentPetName }}</strong>
                <span v-else>{{ match.mode === 'friendly' ? '好友约战' : match.mode === 'pvp' ? '实装对战' : `${match.practice ? '陪练' : '闯关'} · 第 ${match.stage} 关` }}</span>
                <small v-if="match.mode === 'friendly'" class="match-owner">好友约战</small>
                <span v-if="match.opponentOwnerNickname" class="match-owner">{{ match.opponentOwnerNickname }}</span>
                <time :datetime="new Date(match.createdAt).toISOString()">{{ dateTime.format(match.createdAt) }}</time>
              </div>
              <span v-if="match.mode === 'npc'" class="match-reward">+{{ match.reward }}<small> 材料</small></span>
              <PetIcon name="chevron" aria-hidden="true" />
            </li>
          </ul>
          <button v-if="next" type="button" class="more-history" :disabled="historyLoading" @click="loadHistory(next)">更早的战报</button>
        </section>
      </div>
      <div id="brawl-panel-friendly" v-show="section === 'friendly'" class="section-content" role="tabpanel" aria-labelledby="brawl-tab-friendly" tabindex="0">
        <section class="panel">
          <PetBrawlInvitations :active="section === 'friendly'" @replay="viewReport" />
        </section>
      </div>
      <div id="brawl-panel-equipment" v-show="section === 'equipment'" class="section-content" role="tabpanel" aria-labelledby="brawl-tab-equipment" tabindex="0">
        <div v-if="eligible" class="workshop">
          <section class="panel weapon-panel" aria-labelledby="weapon-heading">
            <div class="panel-heading"><h2 id="weapon-heading"><PetIcon name="bag" />武器与招式</h2><span class="subtle">当前装备</span></div>
            <template v-for="group in equipmentGroups" :key="group.label">
              <div v-if="equipment?.weapons.some(item => item.exclusive === group.exclusive)"
                class="weapon-options" role="group" :aria-label="`${group.label}武器`">
                <p class="subtle weapon-group-title">{{ group.label }}武器</p>
                <button v-for="item in equipment.weapons.filter(item => item.exclusive === group.exclusive)" :key="item.id"
                  type="button" :aria-pressed="weapon === item.id" :disabled="locked" @click="weapon = item.id">
                  <PetBrawlWeaponArt :weapon="item.id" :level="state.levels[item.id] ?? 0" :max-level="maxUpgrade"
                    :artifact="Boolean(state.gear?.weapons[item.id]?.artifact)" />
                  <span class="weapon-description"><strong>{{ item.name }}</strong><small v-if="item.effect">{{ item.effect }}</small></span>
                  <span>+{{ state.levels[item.id] }}</span>
                  <PetIcon v-if="weapon === item.id" name="check" />
                </button>
              </div>
            </template>
            <div class="stage-label equipment-field">
              <label for="brawl-workshop-skill">出战招式</label>
              <select id="brawl-workshop-skill" v-model="skill" :disabled="locked"
                :aria-describedby="selectedSkill?.effect ? 'brawl-workshop-skill-effect' : undefined">
                <template v-for="group in equipmentGroups" :key="group.label">
                  <optgroup v-if="equipment?.skills.some(item => item.exclusive === group.exclusive)" :label="group.label">
                    <option v-for="item in equipment.skills.filter(item => item.exclusive === group.exclusive)" :key="item.id" :value="item.id">{{ item.name }}</option>
                  </optgroup>
                </template>
              </select>
              <small v-if="selectedSkill?.effect" id="brawl-workshop-skill-effect">{{ selectedSkill.effect }}</small>
            </div>
            <dl v-if="growth" class="combat-stats large"><div><dt>生命</dt><dd>{{ hp(growth.maxHp + (selectedGear?.hp ?? 0)) }}</dd></div><div><dt>基础伤害</dt><dd>{{ hp(growth.attack + (selectedGear?.attack ?? 0)) }}</dd></div></dl>
            <button v-if="state.pvp?.friendlyWeapon" type="button" class="button-wide"
              :disabled="locked || (state.pvp.friendlyWeapon === weapon && state.pvp.friendlySkill === skill)"
              @click="pvpAction('save')">保存出战配装<PetIcon name="check" /></button>
            <button type="button" class="button-wide" @click="selectSection('arena')">返回对战大厅<PetIcon name="chevron" /></button>
          </section>
          <div class="equipment-column" data-floating-obstacle>
            <section class="panel" aria-labelledby="upgrade-heading">
              <div class="panel-heading">
                <h2 id="upgrade-heading"><PetIcon name="growth" />武器强化</h2>
                <span class="upgrade-weapon">
                  <PetBrawlWeaponArt :weapon="weapon" :level="level" :max-level="maxUpgrade" :artifact="Boolean(selectedGear?.artifact)" :pulse="weaponPulse" />
                  <span class="level-tag">{{ weapons[weapon] }} +{{ level }}</span>
                </span>
              </div>
              <div class="upgrade-track">
                <progress :value="level" :max="maxUpgrade" aria-label="武器强化进度" :aria-valuetext="`+${level} / +${maxUpgrade}`" />
                <div class="upgrade-milestones" aria-hidden="true">
                  <span v-for="milestone in milestones" :key="milestone" :class="{ reached: level >= milestone }">+{{ milestone }}</span>
                </div>
              </div>
              <div v-if="growth && nextGrowth" class="upgrade-preview">
                <span>强化至 +{{ level + 1 }}</span>
                <span>生命 <strong>{{ hp(nextGrowth.maxHp + (selectedGear?.hp ?? 0)) }}</strong> <small>+{{ hp(nextGrowth.maxHp - growth.maxHp) }}</small></span>
                <span>基础伤害 <strong>{{ hp(nextGrowth.attack + (selectedGear?.attack ?? 0)) }}</strong> <small>+{{ hp(nextGrowth.attack - growth.attack) }}</small></span>
              </div>
              <p v-else class="subtle">武器已达最高强化等级。</p>
              <div class="forge-actions"><button type="button" class="primary" :disabled="locked || !cost || state.materials < cost" @click="upgrade()">{{ cost ? `材料强化 · ${cost} 材料` : '已达最高等级' }}</button><PetBrawlCheckout v-if="state.petId" :pet-id="state.petId" :weapon="weapon" :level="level" :version="state.version" :materials="state.materials" :cost="cost" :disabled="locked" :gear-options="gearOptions" /></div>
              <p v-if="cost && state.materials < cost" class="subtle">还差 {{ cost - state.materials }} 材料，可以通过闯关积累。</p>
            </section>
            <section v-if="selectedGear" class="panel" aria-labelledby="socket-heading">
              <div class="panel-heading"><h2 id="socket-heading"><PetIcon name="collection" />神器与镶嵌</h2><span class="subtle">{{ selectedGear.artifact ? '神器已进阶' : '神器未进阶' }}</span></div>
              <p class="subtle">{{ selectedGear.artifact ? '当前装备增益' : level === maxUpgrade ? '可在积分与材料商店中进阶神器' : `武器 +${maxUpgrade} 后可进阶神器` }} · 生命 +{{ hp(selectedGear.hp) }}，基础伤害 +{{ hp(selectedGear.attack) }}</p>
              <div v-for="slot in (['soul', 'rune'] as const)" :key="slot" class="socket-row"><span class="socket-symbol"><PetIcon :name="slot === 'soul' ? 'material' : 'collection'" /></span><label :for="`brawl-slot-${slot}`">{{ slot === 'soul' ? '魂珠槽' : '符石槽' }}<select :id="`brawl-slot-${slot}`" v-model="socketDraft[slot]" :disabled="locked || slot === 'rune' && !selectedGear.slot"><option value="">{{ slot === 'rune' && !selectedGear.slot ? '第二槽未解锁' : '空槽（可拆卸）' }}</option><option v-for="item in ownedSocketItems(slot)" :key="item.id" :value="item.id">{{ item.name }} Lv.{{ item.rank }}</option></select></label><button type="button" :disabled="locked || socketDraft[slot] === selectedGear[slot] || slot === 'rune' && !selectedGear.slot" @click="socket(slot)">{{ socketDraft[slot] ? '保存镶嵌' : '拆卸' }}</button></div>
            </section>
          </div>
        </div>
        <div v-else class="panel empty-history">宠物达到 Lv.{{ state.minLevel }} 后可进行配装强化。</div>
      </div>
      <section id="brawl-panel-season" v-show="section === 'season'" class="panel" data-floating-obstacle role="tabpanel" aria-labelledby="brawl-tab-season" tabindex="0"><PetBrawlSeason /></section>
    </template>
    <p class="sr-only" role="status">{{ status }}</p>
  </main>
</template>

<style scoped>
.brawl-page { display: grid; gap: 20px; padding-bottom: 40px; --brawl-ink: var(--fp-primary-ink, var(--fp-primary)); }
.heading, .panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.heading { padding-block: 2px 4px; }
h1 { margin: 8px 0 0; color: var(--fp-title); font-size: clamp(1.6rem, 1.35rem + .7vw, 2rem); letter-spacing: -.025em; }
h2 { margin: 0; color: var(--fp-title); font-size: 1rem; }
h3 { margin: 0; color: var(--fp-title); font-size: .875rem; }
p { line-height: 1.65; }
.back-link { display: inline-flex; align-items: center; gap: 7px; color: var(--fp-muted); font-size: .8rem; text-decoration: none; }
.back-link svg { width: 15px; height: 15px; }
.back-link:hover { color: var(--brawl-ink); }
.panel, .brawl-overview { min-inline-size: 0; padding: 24px; border: 1px solid var(--fp-border); border-radius: var(--fp-panel-radius, 14px); background: var(--fp-card); }
.panel-heading { margin-bottom: 20px; }
.panel-heading h2 { display: flex; align-items: center; gap: 8px; }
.panel-heading h2 svg { color: var(--fp-muted); width: 18px; height: 18px; }
.brawl-overview { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px 32px; background: linear-gradient(110deg, var(--fp-primary-soft), transparent 60%), var(--fp-card); }
.pet-identity { display: flex; align-items: center; gap: 18px; min-inline-size: 0; }
.pet-identity img { display: block; object-fit: contain; flex: none; }
.pet-identity > div { min-inline-size: 0; }
.pet-identity h2 { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-block: 5px; font-size: 1.3rem; overflow-wrap: anywhere; }
.pet-identity p { margin: 0; color: var(--fp-muted); font-size: .8rem; }
.eyebrow { font-size: .72rem; color: var(--brawl-ink); font-weight: 600; }
.pet-placeholder { display: grid; place-items: center; inline-size: 88px; block-size: 88px; }
.pet-placeholder svg { width: 40px; height: 40px; color: var(--fp-muted); }
.level-tag { display: inline-flex; align-items: center; padding: 4px 9px; border-radius: 6px; background: var(--fp-bg); font-size: .75rem; font-weight: 600; color: var(--fp-muted); white-space: nowrap; }
.overview-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; margin: 0; }
.overview-stats > div { display: grid; gap: 8px; }
dt { color: var(--fp-muted); font-size: .75rem; }
.overview-stats dt { display: flex; align-items: center; gap: 5px; }
.overview-stats dt svg { width: 15px; height: 15px; }
dd { margin: 0; color: var(--fp-title); font-size: 1.6rem; font-weight: 700; font-variant-numeric: tabular-nums; }
dd small { color: var(--fp-muted); font-size: .75rem; font-weight: 400; }
button, select, .button-link { min-block-size: 44px; padding: 8px 14px; border: 1px solid var(--fp-border); border-radius: 9px; background: var(--fp-card); color: var(--fp-text); font: inherit; font-size: .85rem; }
button, .button-link { display: inline-flex; align-items: center; justify-content: center; gap: 7px; transition: background .15s, border-color .15s; }
button:not(:disabled) { cursor: pointer; }
button:hover:not(:disabled) { background: var(--fp-hover); border-color: color-mix(in srgb, var(--fp-muted) 40%, var(--fp-border)); }
button:disabled { opacity: .5; cursor: not-allowed; }
button:focus-visible, select:focus-visible, summary:focus-visible, [role='tabpanel']:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
button.primary { background: var(--fp-primary-fill, var(--fp-primary)); color: #fff; border-color: transparent; font-weight: 600; }
button.primary:hover:not(:disabled) { background: var(--fp-primary-fill-hover, var(--fp-primary-hover)); border-color: transparent; }
button.text-button { border-color: transparent; background: transparent; padding-inline: 6px; color: var(--fp-muted); font-size: .78rem; }
button.text-button:hover:not(:disabled) { color: var(--brawl-ink); background: var(--fp-hover); }
.text-button svg, .refresh-button svg { width: 16px; height: 16px; }
button.button-wide, .button-link { text-decoration: none; color: var(--brawl-ink); }
.button-wide { inline-size: 100%; }
.subtle, time { color: var(--fp-muted); font-size: .8rem; }
.section-tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--fp-border); }
.section-tabs button { position: relative; padding: 12px 20px 16px; background: none; border: 0; border-radius: 8px 8px 0 0; color: var(--fp-muted); font-weight: 600; }
.section-tabs button[aria-selected='true'] { color: var(--brawl-ink); background: var(--fp-primary-soft); }
.section-tabs button[aria-selected='true']::after { content: ''; position: absolute; inset-inline: 16px; bottom: -1px; height: 2px; background: var(--fp-primary); }
.section-tabs svg { width: 18px; height: 18px; }
.section-content { display: grid; gap: 20px; min-inline-size: 0; }
.arena { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(300px, 1fr); gap: 20px; align-items: start; }
.arena.single { grid-template-columns: 1fr; }
.battle { scroll-margin-top: 90px; }
.battle-stage { background: linear-gradient(180deg, var(--fp-bg), var(--fp-card)); border: 1px solid var(--fp-border); border-radius: 12px; padding: 24px 16px 16px; }
.fighters { position: relative; isolation: isolate; display: grid; grid-template-columns: minmax(0, 1fr) 36px minmax(0, 1fr); gap: 8px; align-items: start; }
.fighter { display: grid; justify-items: center; gap: 7px; text-align: center; min-inline-size: 0; }
.fighter-identity { display: grid; gap: 2px; max-inline-size: 100%; min-inline-size: 0; line-height: 1.3; overflow-wrap: anywhere; }
.fighter-identity > span { color: var(--fp-muted); font-size: .75rem; }
.fighter-pet { position: relative; display: grid; justify-items: center; gap: 7px; min-inline-size: 0; color: inherit; text-decoration: none; border-radius: 8px; }
.fighter-pet strong { font-size: .9rem; }
.combat-number {
  position: absolute;
  z-index: 2;
  inset-block-start: 7px;
  inset-inline-start: 50%;
  translate: -50% 0;
  padding: 2px 9px;
  border: 1px solid color-mix(in oklab, currentColor 28%, transparent);
  border-radius: 999px;
  background: var(--fp-card);
  font-size: clamp(.88rem, 1.4vw, 1.1rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
  white-space: nowrap;
  pointer-events: none;
}
.combat-number[data-kind='damage'], .combat-number[data-kind='critical'] { color: var(--fp-danger-ink); }
.combat-number[data-kind='critical'] { background: var(--fp-danger-soft); }
.combat-number[data-kind='heal'] { color: var(--brawl-ink); }
@media (prefers-reduced-motion: no-preference) {
  .combat-number:not(.is-static) { animation: combat-number-rise .48s ease-out both; }
}
@keyframes combat-number-rise {
  from { opacity: .65; transform: translateY(6px) scale(.94); }
  22% { opacity: 1; transform: translateY(0); }
  70% { opacity: 1; }
  to { opacity: .55; transform: translateY(-6px); }
}
a.fighter-pet:hover { color: var(--brawl-ink); }
a.fighter-pet:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
.fighter > span { color: var(--fp-muted); font-size: .73rem; }
.fighter-weapon { display: flex; align-items: center; flex-wrap: wrap; justify-content: center; gap: 7px; min-inline-size: 0; }
.fighter-weapon > span:last-child { display: grid; gap: 2px; min-inline-size: 0; overflow-wrap: anywhere; }
.fighter-weapon strong { color: var(--fp-title); }
.fighter-weapon small { font-size: .7rem; }
.fighter-side { padding: 3px 10px; border-radius: 6px; background: var(--fp-primary-soft); color: var(--brawl-ink) !important; }
.fighter-side.opponent { background: var(--fp-bg); color: var(--fp-muted) !important; }
.projectile-lane { position: absolute; inset: 112px 0 auto; pointer-events: none; z-index: 1; }
.projectile-lane.reversed { transform: scaleX(-1); }
.projectile-lane > span {
  position: absolute;
  left: calc(25% + 26px);
  inline-size: 14px;
  aspect-ratio: 1;
  border-radius: 48% 44% 53% 43%;
  background: var(--shot-tone);
  box-shadow: inset 2px 2px 0 #fff8, -5px 1px 5px color-mix(in oklab, var(--shot-tone) 65%, transparent);
  opacity: 0;
}
.projectile-lane[data-projectile='pebble'] > span { inline-size: 26px; background: none; box-shadow: none; }
.projectile-lane img { display: block; width: 100%; height: 100%; }
.projectile-lane[data-projectile='lotus'] > span { border-radius: 80% 0 80% 35%; }
.projectile-lane[data-projectile='bubble'] > span {
  inline-size: 22px;
  border: 2px solid var(--shot-tone);
  border-radius: 50%;
  background: radial-gradient(circle at 30% 26%, #fff 0 10%, transparent 30%),
    color-mix(in oklab, var(--shot-tone) 35%, transparent);
}
@media (prefers-reduced-motion: no-preference) {
  .projectile-lane > span { animation: weapon-shot var(--shot-duration) linear both; animation-play-state: var(--shot-play-state); }
}
@keyframes weapon-shot {
  0%, 34% { left: calc(25% + 26px); opacity: 0; transform: translateY(4px) scale(.75); }
  37% { opacity: 1; }
  43% { transform: translateY(-12px) scale(1); }
  49% { left: calc(75% - 38px); opacity: 1; transform: translateY(0) scale(1); }
  52%, 100% { left: calc(75% - 38px); opacity: 0; transform: scale(.7); }
}
.versus { margin-top: 90px; color: var(--fp-muted); opacity: .5; font-size: 1.2rem; font-weight: 800; font-style: italic; }
progress { appearance: none; width: 100%; max-width: 10rem; height: 6px; border: 0; border-radius: 10px; accent-color: var(--fp-primary); background: var(--fp-border); }
progress::-webkit-progress-bar { background: var(--fp-border); border-radius: 10px; }
progress::-webkit-progress-value { background: var(--fp-primary); border-radius: 10px; }
progress::-moz-progress-bar { background: var(--fp-primary); border-radius: 10px; }
.turn-readout { margin-block-start: 24px; }
.turn-readout.has-effects { min-block-size: 5.5rem; }
.turn { min-block-size: 2.6em; margin: 0; text-align: center; font-size: .82rem; color: var(--fp-muted); }
.effect-notes { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 6px; margin: 0; padding: 0; list-style: none; }
.effect-notes > li {
  padding: 2px 7px;
  border: 1px solid var(--fp-border);
  border-radius: 6px;
  background: var(--fp-card);
  color: var(--fp-muted);
  font-size: .73rem;
}
.effect-notes b { color: var(--fp-title); font-variant-numeric: tabular-nums; white-space: nowrap; }
.turn-details .effect-notes { justify-content: flex-start; margin-block: 5px 9px; }
.turn.is-ended { color: var(--brawl-ink); font-weight: 600; }
.replay-controls { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.stage-empty { display: grid; justify-items: center; align-content: center; gap: 12px; min-block-size: 300px; text-align: center; }
.stage-empty img { object-fit: contain; }
.stage-empty p { margin: 0; font-size: .8rem; color: var(--fp-muted); }
.stage-empty > svg { width: 64px; height: 64px; color: var(--fp-primary); }
.turn-details { margin-top: 16px; border-top: 1px solid var(--fp-border); padding-top: 12px; color: var(--fp-muted); font-size: .8rem; }
.turn-details summary { cursor: pointer; padding-block: 8px; min-block-size: 44px; }
.turn-details ol { line-height: 1.9; padding-left: 22px; }
.mode-switch { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 4px; background: var(--fp-bg); border-radius: 10px; }
.mode-switch button { border: 0; background: transparent; color: var(--fp-muted); }
.mode-switch button[aria-pressed='true'] { background: var(--fp-card); box-shadow: var(--fp-card-shadow); color: var(--fp-title); font-weight: 600; }
.loadout-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 14px; }
.fields { display: grid; gap: 12px; }
.quick-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
label { display: grid; gap: 8px; font-size: .75rem; color: var(--fp-muted); min-inline-size: 0; }
select { min-inline-size: 0; inline-size: 100%; max-inline-size: 100%; }
.combat-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; padding-block: 16px; border-block: 1px solid var(--fp-border); margin-block: 20px; }
.combat-stats > div + div { padding-left: 18px; border-left: 1px solid var(--fp-border); }
.combat-stats dd { font-size: 1.2rem; margin-top: 4px; }
.combat-stats.large dd { font-size: 1.8rem; }
.pvp-summary { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-size: .8rem; color: var(--fp-muted); }
.registration { padding: 4px 8px; background: var(--fp-bg); border-radius: 6px; font-size: .72rem; }
.registration.ready { background: var(--fp-primary-soft); color: var(--brawl-ink); }
.pvp-summary strong { color: var(--fp-title); }
.config-notice { padding: 10px 12px; border-radius: 8px; background: var(--fp-primary-soft); color: var(--brawl-ink); font-size: .8rem; }
.match-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
.match-actions button { flex: 1 1 130px; }
.control-footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-block: 12px 0; color: var(--fp-muted); font-size: .72rem; }
.stage-label { margin-block: 16px; }
.reward-note { display: flex; align-items: center; gap: 8px; color: var(--brawl-ink); font-size: .8rem; }
.history ul { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.history li { position: relative; display: flex; align-items: center; gap: 14px; min-inline-size: 0; padding: 12px; border: 1px solid var(--fp-border); border-radius: 9px; font-size: .85rem; }
.history li.selected { background: var(--fp-primary-soft); border-color: color-mix(in srgb, var(--fp-primary) 35%, var(--fp-border)); }
.history li:has(.match-replay:hover:not(:disabled)) { background: var(--fp-hover); }
.history .match-replay { position: absolute; inset: 0; z-index: 1; padding: 0; border: 0; background: transparent; }
.match-pet { position: relative; z-index: 2; display: inline-flex; align-items: center; gap: 8px; justify-self: start; max-inline-size: 100%; color: var(--fp-title); text-decoration: none; border-radius: 6px; }
.match-pet:hover { color: var(--brawl-ink); }
.match-pet:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
.match-pet img { flex: none; inline-size: 36px; block-size: 36px; border-radius: 8px; object-fit: contain; background: var(--fp-bg); }
.result-mark { display: grid; place-items: center; width: 42px; height: 42px; flex: none; border-radius: 8px; background: var(--fp-bg); color: var(--fp-muted); font-size: .75rem; font-weight: 600; }
.result-mark.win { color: var(--brawl-ink); background: var(--fp-primary-soft); }
.result-mark.loss { color: var(--fp-muted); }
.match-title { display: grid; gap: 4px; min-inline-size: 0; line-height: 1.3; overflow-wrap: anywhere; }
.match-owner { color: var(--fp-muted); font-size: .75rem; }
.match-title time { font-size: .72rem; }
.match-reward { margin-left: auto; white-space: nowrap; color: var(--fp-muted); font-size: .8rem; font-variant-numeric: tabular-nums; }
.match-reward small { font-size: .72rem; }
.history li svg { width: 16px; height: 16px; flex: none; color: var(--fp-muted); margin-left: auto; }
.more-history { margin-top: 16px; width: 100%; }
.empty-history { color: var(--fp-muted); text-align: center; padding-block: 24px; font-size: .85rem; }
.workshop { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(0, 1.6fr); gap: 20px; align-items: start; }
.equipment-column { display: grid; gap: 20px; min-inline-size: 0; }
.weapon-options { display: grid; gap: 10px; }
.weapon-options + .weapon-options { margin-block-start: 16px; }
.weapon-group-title { margin: 0; }
.equipment-field { display: grid; align-content: start; gap: 8px; min-inline-size: 0; }
.weapon-description { display: grid; gap: 3px; min-inline-size: 0; text-align: start; }
.weapon-description small, .quick-fields small, .stage-label small { color: var(--fp-muted); font-size: .72rem; }
.weapon-options button { display: flex; justify-content: start; padding: 12px; gap: 12px; }
.weapon-options button[aria-pressed='true'] { background: var(--fp-primary-soft); border-color: var(--fp-primary); color: var(--brawl-ink); }
.weapon-options button strong { font-size: .85rem; }
.weapon-options button > span:nth-child(3) { margin-inline-start: auto; }
.upgrade-weapon { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.upgrade-track { display: grid; gap: 8px; margin-block: 20px; }
.upgrade-track progress { max-width: none; height: 8px; }
.upgrade-milestones { display: flex; justify-content: space-between; color: var(--fp-muted); font-size: .75rem; font-variant-numeric: tabular-nums; }
.upgrade-milestones .reached { color: var(--brawl-ink); font-weight: 600; }
.upgrade-preview { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-bottom: 20px; color: var(--fp-muted); font-size: .8rem; }
.upgrade-preview strong { color: var(--fp-text); }
.upgrade-preview small { color: var(--brawl-ink); font-weight: 600; }
.forge-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.socket-row { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding-block: 16px; }
.socket-row + .socket-row { border-top: 1px solid var(--fp-border); }
.socket-symbol { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 9px; background: var(--fp-bg); color: var(--brawl-ink); }
.socket-row button { align-self: end; }
.unlock-panel { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.unlock-symbol { display: grid; place-items: center; width: 44px; height: 44px; background: var(--fp-bg); border-radius: 10px; color: var(--fp-muted); }
.unlock-panel p { margin-bottom: 0; }
.unlock-panel .button-link { margin-inline-start: auto; }
.loading-state, .error-state { color: var(--fp-muted); font-size: .85rem; }
.sr-only { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }
@media (max-width: 1000px) {
  .brawl-overview { gap: 20px; }
  .overview-stats { flex: 1 1 100%; padding-top: 18px; border-top: 1px solid var(--fp-border); gap: 16px; }
  .arena { grid-template-columns: minmax(0, 1.1fr) minmax(290px, 1fr); }
  .panel { padding: 20px; }
}
@media (max-width: 760px) {
  .brawl-page, .section-content { gap: 16px; }
  .arena, .workshop { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .history ul { grid-template-columns: minmax(0, 1fr); }
  .section-tabs { gap: 2px; }
  .section-tabs button { flex: 1; padding: 12px 6px; font-size: .8rem; gap: 5px; }
  .section-tabs svg { width: 16px; height: 16px; }
  .brawl-overview { padding: 18px; }
  .pet-identity { gap: 12px; }
  .pet-identity img { width: 64px; height: 64px; }
  .pet-identity h2 { font-size: 1.1rem; }
  .overview-stats { gap: 10px; }
  .overview-stats dd { font-size: 1.3rem; }
  .overview-stats dt { font-size: .67rem; gap: 4px; }
  .overview-stats dt svg { display: none; }
  .panel { padding: 16px; }
  .panel-heading { margin-bottom: 16px; }
  .battle-stage { padding: 16px 10px; }
  .stage-empty { min-block-size: 230px; }
  .stage-empty img { width: 120px; height: 120px; }
  .fighter-avatar { inline-size: 96px; }
  .fighters { grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr); gap: 4px; }
  .versus { margin-top: 65px; font-size: 1rem; }
  .unlock-panel .button-link { width: 100%; }
  .socket-row { grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
  .socket-symbol { display: none; }
  .forge-actions > * { flex: 1 1 160px; }
}
@media (prefers-reduced-motion: reduce) { button, .button-link { transition: none; } }
@media (max-width: 400px) {
  .section-tabs svg { display: none; }
}
</style>
