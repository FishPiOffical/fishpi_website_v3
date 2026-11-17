<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { getAuthContextVersion } from '@/api/http'
import { brawlSkills, brawlWeapons, readBrawlHistory, readBrawlReport, readBrawlState, type BrawlProduct, type BrawlSkill, type BrawlSlot, type BrawlSummary, type BrawlWeapon } from '@/api/v3-pets'
import { petBattlePoster, petPortrait, type PetBattleAction } from '@/components/pets/animations'
import PetAnimation from '@/components/pets/PetAnimation.vue'
import PetFeedback from '@/components/pets/PetFeedback.vue'
import PetBrawlCheckout from '@/components/pets/PetBrawlCheckout.vue'
import PetBrawlSeason from '@/components/pets/PetBrawlSeason.vue'
import PetIcon from '@/components/pets/PetIcon.vue'
import { imageThumbnail } from '@/utils/avatar'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore } from '@/stores/pets'

usePageSeo(() => ({ title: '宠物乱斗', path: '/pets/brawl', robots: 'noindex' }))
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
const stage = ref(1)
const section = ref<'arena' | 'equipment' | 'season'>('arena')
const sectionTabs = ref<HTMLElement | null>(null)
const battleMode = ref<'pvp' | 'npc'>('pvp')
const sections = [
  { id: 'arena', label: '对战大厅', icon: 'play' },
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
const frame = ref(0)
const playing = ref(false)
const compact = ref(true)
const fighters = ref<HTMLElement | null>(null)
const playbackKey = ref(0)
const stepDuration = 1000
let deadline = 0
let remaining = stepDuration
let compactQuery: MediaQueryList | undefined
let mounted = false
let timer: ReturnType<typeof setTimeout> | undefined
let stateRequest: AbortController | undefined
let historyRequest: AbortController | undefined
let reportRequest: AbortController | undefined
const weapons = { SPOON: '小木勺', GUARD: '软垫护腕', FAN: '折纸扇' }
const skills = { SPLASH: '拍水花', CURL: '卷成一团', BREATHE: '深呼吸' }
const opponents = ['水花练习生', '护腕学徒', '折扇教练']
const dateTime = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Shanghai' })
const eligible = computed(() => !!state.value?.petId && state.value.level >= state.value.minLevel)
const locked = computed(() => loading.value || !!error.value || pets.busy || !!pets.pending || pets.offline)
const pvpDirty = computed(() => !!state.value?.pvp?.enabled &&
  (state.value.pvp.weapon !== weapon.value || state.value.pvp.skill !== skill.value))
const level = computed(() => state.value?.levels[weapon.value] ?? 0)
const growth = computed(() => state.value?.growth[level.value])
const nextGrowth = computed(() => state.value?.growth[level.value + 1])
const selectedGear = computed(() => state.value?.gear?.weapons[weapon.value])
const gearOptions = computed(() => {
  if (!selectedGear.value || !state.value?.gear) return []
  const current = selectedGear.value
  return state.value.gear.catalog.map(item => {
    const rank = item.id === 'ARTIFACT' ? current.artifact : item.id === 'SLOT' ? current.slot : item.rank
    const cost = item.id === 'ARTIFACT' && level.value < 5 ? undefined : item.costs[rank]
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
function battleAction(side: number): PetBattleAction | undefined {
  if (ended.value) {
    const winner = report.value?.winner
    if (winner == null || winner < 0) return
    return winner === side ? 'victory' : 'defeat'
  }
  return turn.value ? turn.value.actor === side ? 'attack' : 'hit' : undefined
}
const resultLabel = (winner: number) => winner === 0 ? '胜利' : winner === 1 ? '落败' : '平局'
const describe = (reason: unknown) => reason instanceof Error ? reason.message : '读取失败，请重试'
const hp = (centi: number) => (centi / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })

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
    if (changedPet && result.pvp?.weapon && result.pvp.skill) {
      weapon.value = result.pvp.weapon
      skill.value = result.pvp.skill
    }
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
function scheduleStep() {
  deadline = performance.now() + remaining
  timer = setTimeout(() => {
    if (!report.value || !playing.value) return
    if (ended.value) {
      stop()
      status.value = resultLabel(report.value.winner)
      return
    }
    frame.value++
    if (ended.value && report.value.winner < 0) {
      skip()
      return
    }
    remaining = stepDuration
    scheduleStep()
  }, remaining)
}
function updateCompact() { compact.value = compactQuery?.matches ?? true }
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

async function pvpAction(action: 'enroll' | 'withdraw' | 'match') {
  const current = state.value
  if (locked.value || !eligible.value || !current?.petId || !current.pvp) return
  if (action === 'match' && (!current.pvp.enabled || !current.pvp.remaining || pvpDirty.value)) return
  const input = { petId: current.petId, version: current.version, revision: current.pvp.revision }
  status.value = ''
  const ok = await pets.executeBrawl(action === 'match' ? { ...input, kind: 'brawl-match' } : {
    ...input, kind: 'brawl-enroll', enabled: action === 'enroll', weapon: weapon.value, skill: skill.value,
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
  if (event.kind === 'brawl-enroll') {
    status.value = '对战报名已更新'
    void refresh()
  }
  if (event.kind === 'brawl-socket') {
    status.value = '镶嵌配置已保存'
    void refresh()
  }
  if (event.kind === 'brawl-season-claim') void refresh()
  if (event.kind === 'brawl-upgrade' || event.kind === 'brawl-confirm') {
    status.value = '强化完成'
    void refresh()
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
  loading.value = historyLoading.value = reportLoading.value = false
  section.value = 'arena'
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
  compactQuery = window.matchMedia('(max-width: 720px), (hover: none) and (pointer: coarse)')
  compactQuery.addEventListener('change', updateCompact)
  document.addEventListener('visibilitychange', pauseWhenHidden)
  updateCompact()
  initialize()
})
onUnmounted(() => {
  mounted = false
  compactQuery?.removeEventListener('change', updateCompact)
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
            <div class="panel-heading"><h2 id="battle-heading"><PetIcon name="play" />对局回放</h2><span v-if="report" class="subtle">{{ report.mode === 'pvp' ? report.season ? `第 ${report.season} 赛季` : '实装对战' : report.practice ? '陪练' : `第 ${report.stage} 关` }}</span><span v-else class="subtle">等待开场</span></div>
            <p v-if="reportLoading" role="status" class="subtle">正在读取战报…</p>
            <p v-if="reportError && retryReport" role="alert" class="error-state">{{ reportError }} <button type="button" @click="openReport(retryReport)">重读战报</button></p>
            <div ref="fighters" class="battle-stage">
              <template v-if="report">
                <div class="fighters">
                  <div class="fighter">
                    <span class="fighter-side">我方</span>
                    <div class="fighter-avatar">
                      <PetAnimation v-if="!compact && battleAction(0)" :species="report.species" alt=""
                        :battle-action="battleAction(0)" :playback-key="`${report.id}:${playbackKey}:${frame}`" :active="playing && section === 'arena'"
                        :loop="false" hold-frame :width="160" :height="160" />
                      <img v-else :src="petBattlePoster(report.species)" alt="" width="160" height="160" />
                    </div>
                    <div class="fighter-names">
                      <strong>{{ report.player.petName ?? '我的宠物' }}</strong>
                      <span v-if="report.player.ownerNickname">{{ report.player.ownerNickname }}</span>
                    </div>
                    <span>{{ weapons[report.player.weapon] }} +{{ report.player.level }}</span>
                    <span v-if="report.player.gearHp || report.player.gearAttack">配装 生命 +{{ hp(report.player.gearHp) }} · 伤害 +{{ hp(report.player.gearAttack) }}</span>
                    <progress aria-label="我的宠物生命" :max="report.player.maxHp" :value="turn?.playerHp ?? report.player.maxHp" />
                    <span>{{ hp(turn?.playerHp ?? report.player.maxHp) }} / {{ hp(report.player.maxHp) }}</span>
                  </div>
                  <span class="versus" aria-hidden="true">VS</span>
                  <div class="fighter">
                    <span class="fighter-side opponent">对手</span>
                    <div class="fighter-avatar fighter-avatar--opponent">
                      <PetAnimation v-if="!compact && battleAction(1)" :species="report.opponentSpecies ?? 'momota'" alt=""
                        :battle-action="battleAction(1)" :playback-key="`${report.id}:${playbackKey}:${frame}`" :active="playing && section === 'arena'"
                        :loop="false" hold-frame :width="160" :height="160" />
                      <img v-else :src="petBattlePoster(report.opponentSpecies ?? 'momota')" alt="" width="160" height="160" />
                    </div>
                    <div class="fighter-names">
                      <strong>{{ report.mode === 'pvp' ? report.opponent.petName ?? '对手宠物' : opponents[report.stage - 1] }}</strong>
                      <span v-if="report.opponent.ownerNickname">{{ report.opponent.ownerNickname }}</span>
                    </div>
                    <span>{{ weapons[report.opponent.weapon] }} +{{ report.opponent.level }}</span>
                    <span v-if="report.opponent.gearHp || report.opponent.gearAttack">配装 生命 +{{ hp(report.opponent.gearHp) }} · 伤害 +{{ hp(report.opponent.gearAttack) }}</span>
                    <progress aria-label="对手生命" :max="report.opponent.maxHp" :value="turn?.opponentHp ?? report.opponent.maxHp" />
                    <span>{{ hp(turn?.opponentHp ?? report.opponent.maxHp) }} / {{ hp(report.opponent.maxHp) }}</span>
                  </div>
                </div>
                <p class="turn" :class="{ 'is-ended': ended }">{{ ended ? `${resultLabel(report.winner)}${report.mode === 'pvp' ? '' : ` · 获得 ${report.reward} 材料`}` : turn ? `第 ${turn.round} 回合 · ${turn.actor === 0 ? '我方' : '对手'}造成 ${hp(turn.damage)} 伤害${turn.healing ? `，回复 ${hp(turn.healing)} 生命` : ''}` : '准备开战' }}</p>
              </template>
              <div v-else class="stage-empty">
                <img v-if="portrait(state.species)" :src="portrait(state.species)" width="160" height="160" alt="" />
                <PetIcon v-else name="play" />
                <h3>{{ eligible ? '准备好，开始第一场较量' : '未来的对手在这里等你' }}</h3>
                <p>{{ eligible ? '选择玩家对战，或从闯关陪练开始。' : `达到 Lv.${state.minLevel} 后即可参加。` }}</p>
              </div>
            </div>
            <div v-if="report" class="replay-controls" data-floating-obstacle><span class="subtle">{{ ended ? '对局已结束' : `回合 ${turn?.round ?? 0} / ${report.turns[report.turns.length - 1]?.round}` }}</span><div class="actions"><button type="button" :disabled="reportLoading" @click="playing ? stop() : play()"><PetIcon :name="playing ? 'rest' : 'refresh'" />{{ playing ? '暂停' : ended ? '重播' : '继续' }}</button><button type="button" :disabled="reportLoading || (ended && !playing)" @click="skip()">跳过</button></div></div>
            <details v-if="report && ended" class="turn-details"><summary>逐回合战报</summary><ol><li v-for="(event, index) in report.turns" :key="index">第 {{ event.round }} 回合 · {{ event.actor === 0 ? '我方' : '对手' }}造成 {{ hp(event.damage) }} 伤害<span v-if="event.healing">，回复 {{ hp(event.healing) }} 生命</span></li></ol></details>
          </section>
          <section v-if="eligible" class="panel battle-controls" data-floating-obstacle aria-label="出战操作">
            <div class="mode-switch" aria-label="对战方式"><button v-if="state.pvp" type="button" :aria-pressed="battleMode === 'pvp'" @click="battleMode = 'pvp'">玩家对战</button><button type="button" :aria-pressed="battleMode === 'npc' || !state.pvp" @click="battleMode = 'npc'">闯关陪练</button></div>
            <div class="loadout-heading"><h3>本次出战配置</h3><button type="button" class="text-button" @click="selectSection('equipment')">调整配装<PetIcon name="chevron" /></button></div>
            <div class="fields quick-fields"><label>武器<select v-model="weapon" :disabled="locked"><option v-for="item in brawlWeapons" :key="item" :value="item">{{ weapons[item] }} +{{ state.levels[item] }}</option></select></label><label>招式<select v-model="skill" :disabled="locked"><option v-for="item in brawlSkills" :key="item" :value="item">{{ skills[item] }}</option></select></label></div>
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
            <li v-for="match in matches" :key="match.id">
              <button type="button" :class="{ selected: report?.id === match.id }" :disabled="reportLoading" @click="viewReport(match.id)">
                <span class="result-mark" :class="{ win: match.winner === 0, loss: match.winner === 1 }">{{ resultLabel(match.winner) }}</span>
                <span class="match-title">
                  <strong v-if="match.opponentPetName">{{ match.opponentPetName }}</strong>
                  <span v-else>{{ match.mode === 'pvp' ? '实装对战' : `${match.practice ? '陪练' : '闯关'} · 第 ${match.stage} 关` }}</span>
                  <span v-if="match.opponentOwnerNickname" class="match-owner">{{ match.opponentOwnerNickname }}</span>
                  <time :datetime="new Date(match.createdAt).toISOString()">{{ dateTime.format(match.createdAt) }}</time>
                </span>
                <span v-if="match.mode !== 'pvp'" class="match-reward">+{{ match.reward }}<small> 材料</small></span>
                <PetIcon name="chevron" />
              </button>
            </li>
          </ul>
          <button v-if="next" type="button" class="more-history" :disabled="historyLoading" @click="loadHistory(next)">更早的战报</button>
        </section>
      </div>
      <div id="brawl-panel-equipment" v-show="section === 'equipment'" class="section-content" role="tabpanel" aria-labelledby="brawl-tab-equipment" tabindex="0">
        <div v-if="eligible" class="workshop">
          <section class="panel weapon-panel" aria-labelledby="weapon-heading">
            <div class="panel-heading"><h2 id="weapon-heading"><PetIcon name="bag" />武器与招式</h2><span class="subtle">当前装备</span></div>
            <div class="weapon-options" aria-label="选择武器"><button v-for="item in brawlWeapons" :key="item" type="button" :aria-pressed="weapon === item" :disabled="locked" @click="weapon = item"><span class="weapon-symbol"><PetIcon :name="item === 'SPOON' ? 'feed' : item === 'GUARD' ? 'care' : 'outing'" /></span><strong>{{ weapons[item] }}</strong><span>+{{ state.levels[item] }}</span><PetIcon v-if="weapon === item" name="check" /></button></div>
            <label class="stage-label">出战招式<select v-model="skill" :disabled="locked"><option v-for="item in brawlSkills" :key="item" :value="item">{{ skills[item] }}</option></select></label>
            <dl v-if="growth" class="combat-stats large"><div><dt>生命</dt><dd>{{ hp(growth.maxHp + (selectedGear?.hp ?? 0)) }}</dd></div><div><dt>基础伤害</dt><dd>{{ hp(growth.attack + (selectedGear?.attack ?? 0)) }}</dd></div></dl>
            <p v-if="pvpDirty" class="config-notice">报名配置待更新，请到对战大厅保存。</p>
            <button type="button" class="button-wide" @click="selectSection('arena')">返回对战大厅<PetIcon name="chevron" /></button>
          </section>
          <div class="equipment-column" data-floating-obstacle>
            <section class="panel" aria-labelledby="upgrade-heading">
              <div class="panel-heading"><h2 id="upgrade-heading"><PetIcon name="growth" />武器强化</h2><span class="level-tag">{{ weapons[weapon] }} +{{ level }}</span></div>
              <div class="upgrade-track" aria-label="强化等级"><span v-for="n in 6" :key="n" :class="{ reached: level >= n - 1, current: level === n - 1 }">+{{ n - 1 }}</span></div>
              <div v-if="nextGrowth" class="upgrade-preview"><span>强化至 +{{ level + 1 }}</span><span>生命 <strong>{{ hp(nextGrowth.maxHp + (selectedGear?.hp ?? 0)) }}</strong></span><span>基础伤害 <strong>{{ hp(nextGrowth.attack + (selectedGear?.attack ?? 0)) }}</strong></span></div>
              <p v-else class="subtle">武器已达最高强化等级。</p>
              <div class="forge-actions"><button type="button" class="primary" :disabled="locked || !cost || state.materials < cost" @click="upgrade()">{{ cost ? `材料强化 · ${cost} 材料` : '已达最高等级' }}</button><PetBrawlCheckout v-if="state.petId" :pet-id="state.petId" :weapon="weapon" :level="level" :version="state.version" :materials="state.materials" :cost="cost" :disabled="locked" :gear-options="gearOptions" /></div>
              <p v-if="cost && state.materials < cost" class="subtle">还差 {{ cost - state.materials }} 材料，可以通过闯关积累。</p>
            </section>
            <section v-if="selectedGear" class="panel" aria-labelledby="socket-heading">
              <div class="panel-heading"><h2 id="socket-heading"><PetIcon name="collection" />神器与镶嵌</h2><span class="subtle">{{ selectedGear.artifact ? '神器已进阶' : '神器未进阶' }}</span></div>
              <p class="subtle">{{ selectedGear.artifact ? '当前装备增益' : level === 5 ? '可在积分与材料商店中进阶神器' : '武器 +5 后可进阶神器' }} · 生命 +{{ hp(selectedGear.hp) }}，基础伤害 +{{ hp(selectedGear.attack) }}</p>
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
.fighters { display: grid; grid-template-columns: minmax(0, 1fr) 36px minmax(0, 1fr); gap: 8px; align-items: start; }
.fighter { display: grid; justify-items: center; gap: 7px; text-align: center; min-inline-size: 0; }
.fighter-names { display: grid; gap: 2px; max-inline-size: 100%; min-inline-size: 0; line-height: 1.3; overflow-wrap: anywhere; }
.fighter-names strong { font-size: .9rem; }
.fighter-names span { color: var(--fp-muted); font-size: .75rem; }
.fighter > span { color: var(--fp-muted); font-size: .73rem; }
.fighter-side { padding: 3px 10px; border-radius: 6px; background: var(--fp-primary-soft); color: var(--brawl-ink) !important; }
.fighter-side.opponent { background: var(--fp-bg); color: var(--fp-muted) !important; }
.fighter-avatar { inline-size: 160px; max-inline-size: 100%; aspect-ratio: 1; }
.fighter-avatar img { display: block; inline-size: 100%; block-size: 100%; object-fit: contain; }
.fighter-avatar--opponent { transform: scaleX(-1); }
.versus { margin-top: 90px; color: var(--fp-muted); opacity: .5; font-size: 1.2rem; font-weight: 800; font-style: italic; }
progress { appearance: none; width: 100%; max-width: 10rem; height: 6px; border: 0; border-radius: 10px; accent-color: var(--fp-primary); background: var(--fp-border); }
progress::-webkit-progress-bar { background: var(--fp-border); border-radius: 10px; }
progress::-webkit-progress-value { background: var(--fp-primary); border-radius: 10px; }
progress::-moz-progress-bar { background: var(--fp-primary); border-radius: 10px; }
.turn { min-block-size: 2.6em; margin: 24px 0 0; text-align: center; font-size: .82rem; color: var(--fp-muted); }
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
.history li { min-inline-size: 0; }
.history li button { display: flex; align-items: center; gap: 14px; width: 100%; text-align: start; padding: 12px; }
.history li button.selected { background: var(--fp-primary-soft); border-color: color-mix(in srgb, var(--fp-primary) 35%, var(--fp-border)); }
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
.weapon-options button { display: flex; justify-content: start; padding: 12px; gap: 12px; }
.weapon-options button[aria-pressed='true'] { background: var(--fp-primary-soft); border-color: var(--fp-primary); color: var(--brawl-ink); }
.weapon-options button strong { font-size: .85rem; }
.weapon-options button > span:not(.weapon-symbol) { margin-left: auto; }
.weapon-symbol { display: grid; place-items: center; width: 36px; height: 36px; background: var(--fp-bg); border-radius: 8px; }
.upgrade-track { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; margin-block: 24px; }
.upgrade-track span { display: grid; place-items: center; padding-block: 10px; border-radius: 6px; background: var(--fp-bg); border: 1px solid var(--fp-border); font-size: .8rem; color: var(--fp-muted); }
.upgrade-track span.reached { background: var(--fp-primary-soft); color: var(--brawl-ink); border-color: transparent; }
.upgrade-track span.current { border-color: var(--fp-primary); font-weight: 700; }
.upgrade-preview { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-bottom: 20px; color: var(--fp-muted); font-size: .8rem; }
.upgrade-preview strong { color: var(--fp-text); }
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
</style>
