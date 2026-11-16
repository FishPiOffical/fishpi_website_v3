<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { getAuthContextVersion } from '@/api/http'
import { brawlSkills, brawlWeapons, readBrawlHistory, readBrawlReport, readBrawlState, type BrawlSkill, type BrawlSummary, type BrawlWeapon } from '@/api/v3-pets'
import { petPortrait } from '@/components/pets/animations'
import PetFeedback from '@/components/pets/PetFeedback.vue'
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
const frame = ref(0)
const playing = ref(false)
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
const cost = computed(() => state.value?.costs[level.value])
const turn = computed(() => report.value?.turns[frame.value - 1])
const ended = computed(() => !!report.value && frame.value >= report.value.turns.length)
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
    frame.value = autoplay ? 0 : result.turns.length
    retryReport.value = undefined
    if (autoplay && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) play()
    else skip()
  } catch (reason) {
    if (!request.signal.aborted) reportError.value = describe(reason)
  } finally {
    if (!request.signal.aborted) reportLoading.value = false
  }
}

function stop() {
  clearTimeout(timer)
  playing.value = false
}
function skip() {
  stop()
  if (!report.value) return
  frame.value = report.value.turns.length
  status.value = resultLabel(report.value.winner)
}
function play() {
  if (!report.value || playing.value) return
  if (ended.value) frame.value = 0
  playing.value = true
  function tick() {
    if (!report.value) return
    frame.value++
    if (ended.value) skip()
    else timer = setTimeout(tick, 300)
  }
  timer = setTimeout(tick, 300)
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
  if (event.kind === 'brawl-upgrade') {
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
onMounted(() => { mounted = true; initialize() })
onUnmounted(() => { mounted = false; clear() })
</script>

<template>
  <main class="fp-page fp-page--wide fp-ui brawl-page">
    <header class="heading">
      <div><RouterLink to="/pets">宠物家园</RouterLink><h1>宠物乱斗</h1></div>
      <div v-if="state" class="materials"><strong>{{ state.materials.toLocaleString() }}</strong><span>历练材料</span></div>
    </header>
    <PetFeedback />
    <p v-if="loading && !state" role="status">正在读取乱斗进度…</p>
    <div v-if="error" class="panel"><p role="alert">{{ error }}</p><button type="button" @click="refresh()">重新读取进度</button></div>
    <section v-if="state && !eligible" class="panel">
      <h2>Lv.{{ state.minLevel }} 解锁乱斗</h2>
      <p>{{ state.petId ? `当前宠物 Lv.${state.level}` : '请先领养一只宠物。' }}</p>
      <RouterLink to="/pets">返回宠物家园</RouterLink>
    </section>
    <div v-if="state && (eligible || report || reportLoading)" class="arena" :class="{ single: !eligible }">
      <section v-if="eligible" class="panel">
        <h2>出战配置</h2>
        <div class="fields">
          <label>武器<select v-model="weapon" :disabled="locked"><option v-for="item in brawlWeapons" :key="item" :value="item">{{ weapons[item] }} +{{ state.levels[item] }}</option></select></label>
          <label>招式<select v-model="skill" :disabled="locked"><option v-for="item in brawlSkills" :key="item" :value="item">{{ skills[item] }}</option></select></label>
          <label>对手<select v-model.number="stage" :disabled="locked"><option v-for="item in state.stages" :key="item" :value="item">第 {{ item }} 关 · {{ opponents[item - 1] }}{{ item <= state.cleared ? '（已通关）' : item > state.unlocked ? '（仅陪练）' : '' }}</option></select></label>
        </div>
        <p v-if="growth" class="subtle">生命 {{ hp(growth.maxHp) }} · 基础伤害 {{ hp(growth.attack) }}</p>
        <p v-if="nextGrowth" class="subtle">下一级 · 生命 {{ hp(nextGrowth.maxHp) }} · 基础伤害 {{ hp(nextGrowth.attack) }}</p>
        <div class="actions">
          <button type="button" :disabled="locked || !cost || state.materials < cost" @click="upgrade()">{{ cost ? `强化至 +${level + 1} · ${cost} 材料` : '已达最高等级' }}</button>
        </div>
        <template v-if="state.pvp">
          <hr />
          <h2>实装对战</h2>
          <p class="subtle">报名后可在离线时接受挑战。对局使用报名武器及其开战时的强化等级。</p>
          <p class="subtle" role="status">{{ state.pvp.enabled ? '已报名' : '未报名' }} · 今日还可主动挑战 {{ state.pvp.remaining }} 场 · 被挑战 {{ state.pvp.received }} / {{ state.pvp.receivedLimit }}</p>
          <p v-if="pvpDirty" class="subtle">保存当前配置后即可匹配。</p>
          <div class="actions">
            <button v-if="!state.pvp.enabled || pvpDirty" type="button" :disabled="locked" @click="pvpAction('enroll')">{{ state.pvp.enabled ? '保存对战配置' : '报名接受匹配' }}</button>
            <button v-if="state.pvp.enabled" type="button" :disabled="locked" @click="pvpAction('withdraw')">退出报名</button>
            <button type="button" class="primary" :disabled="locked || !state.pvp.enabled || !state.pvp.remaining || pvpDirty" @click="pvpAction('match')">寻找对手</button>
          </div>
        </template>
        <hr />
        <p class="subtle">今日闯关奖励 {{ state.rewardCount }} / {{ state.rewards.length }} 场。{{ state.rewards[state.rewardCount] ? `下场可得 ${state.rewards[state.rewardCount]} 材料。` : '今日材料已领完。' }}</p>
        <div class="actions">
          <button type="button" :disabled="locked" @click="fight(true)">开始陪练</button>
          <button type="button" class="primary" :disabled="locked || stage > state.unlocked" @click="fight(false)">开始闯关</button>
        </div>
      </section>
      <section class="panel battle" aria-labelledby="battle-heading">
        <h2 id="battle-heading">对局回放</h2>
        <p v-if="reportLoading" role="status">正在读取战报…</p>
        <template v-if="report">
          <div class="fighters">
            <div>
              <img :src="petPortrait(report.species)" alt="" width="86" height="86">
              <strong>我的宠物</strong><span>{{ weapons[report.player.weapon] }} +{{ report.player.level }}</span>
              <progress aria-label="我的宠物生命" :max="report.player.maxHp" :value="turn?.playerHp ?? report.player.maxHp" />
              <span>{{ hp(turn?.playerHp ?? report.player.maxHp) }} / {{ hp(report.player.maxHp) }}</span>
            </div>
            <div>
              <img :src="petPortrait(report.opponentSpecies ?? 'momota')" alt="" width="86" height="86">
              <strong>{{ report.mode === 'pvp' ? '对手宠物' : opponents[report.stage - 1] }}</strong><span>{{ weapons[report.opponent.weapon] }} +{{ report.opponent.level }}</span>
              <progress aria-label="对手生命" :max="report.opponent.maxHp" :value="turn?.opponentHp ?? report.opponent.maxHp" />
              <span>{{ hp(turn?.opponentHp ?? report.opponent.maxHp) }} / {{ hp(report.opponent.maxHp) }}</span>
            </div>
          </div>
          <p class="turn">{{ ended ? `${resultLabel(report.winner)}${report.mode === 'pvp' ? '' : ` · 获得 ${report.reward} 材料`}` : turn ? `第 ${turn.round} 回合 · ${turn.actor === 0 ? '我方' : '对手'}造成 ${hp(turn.damage)} 伤害${turn.healing ? `，回复 ${hp(turn.healing)} 生命` : ''}` : '准备开战' }}</p>
          <div class="actions">
            <button type="button" @click="playing ? stop() : play()">{{ playing ? '暂停' : ended ? '重播' : '继续' }}</button>
            <button type="button" :disabled="ended" @click="skip()">跳过</button>
          </div>
          <details v-if="ended"><summary>逐回合战报</summary><ol>
            <li v-for="(event, index) in report.turns" :key="index">第 {{ event.round }} 回合 · {{ event.actor === 0 ? '我方' : '对手' }}造成 {{ hp(event.damage) }} 伤害<span v-if="event.healing">，回复 {{ hp(event.healing) }} 生命</span></li>
          </ol></details>
        </template>
        <p v-else-if="!reportLoading" class="subtle">开始一场陪练或闯关即可观看回放。</p>
      </section>
    </div>
    <p class="sr-only" role="status">{{ status }}</p>
    <section v-if="state" class="panel history">
      <div class="history-heading"><h2>我的战报</h2><button type="button" :disabled="historyLoading" @click="refresh(); loadHistory()">刷新</button></div>
      <p v-if="reportError" role="alert">{{ reportError }} <button v-if="retryReport" type="button" @click="openReport(retryReport)">重读战报</button></p>
      <p v-if="!matches.length && !historyLoading && !reportError" class="subtle">还没有战报。</p>
      <ul v-if="matches.length">
        <li v-for="match in matches" :key="match.id"><button type="button"  :disabled="reportLoading" @click="openReport(match.id)">
          <span>{{ match.mode === 'pvp' ? '实装对战' : `${match.practice ? '陪练' : '闯关'} · 第 ${match.stage} 关` }} · {{ resultLabel(match.winner) }}</span>
          <time :datetime="new Date(match.createdAt).toISOString()">{{ dateTime.format(match.createdAt) }}</time>
        </button></li>
      </ul>
      <button v-if="next" type="button" :disabled="historyLoading" @click="loadHistory(next)">更早的战报</button>
    </section>
  </main>
</template>

<style scoped>
.brawl-page { display: grid; gap: 16px; padding-bottom: 32px; }
.heading, .history-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
h1 { margin: 6px 0 0; color: var(--fp-title); }
h2 { margin: 0; font-size: 1.125rem; color: var(--fp-title); }
.materials { display: grid; text-align: end; font-size: .85rem; color: var(--fp-muted); }
.materials strong { color: var(--fp-text); font-size: 1.45rem; font-variant-numeric: tabular-nums; }
.arena { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 16px; align-items: start; }
.arena.single { grid-template-columns: 1fr; }
.sr-only { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }
.panel { padding: clamp(16px, 3vw, 24px); border: 1px solid var(--fp-border); border-radius: 12px; background: var(--fp-card); }
.fields { display: grid; gap: 12px; margin-top: 16px; }
.fields label { display: grid; gap: 5px; color: var(--fp-muted); }
select, button { min-block-size: 44px; padding-inline: 12px; border: 1px solid var(--fp-border); border-radius: 8px; background: var(--fp-card); color: var(--fp-text); font: inherit; }
button:not(:disabled) { cursor: pointer; }
button:not(:disabled):hover { background: var(--fp-hover); }
button.primary:not(:disabled) { background: var(--fp-primary-soft); color: var(--fp-primary); }
button:disabled { opacity: .55; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.subtle, time { color: var(--fp-muted); font-size: .875rem; }
hr { border: 0; border-top: 1px solid var(--fp-border); margin: 16px 0; }
.fighters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
.fighters > div { display: grid; justify-items: center; gap: 5px; text-align: center; }
.fighters span { font-size: .82rem; color: var(--fp-muted); }
.fighters img { object-fit: contain; }
progress { width: 100%; max-width: 10rem; accent-color: var(--fp-primary); }
.turn { min-block-size: 2.6em; margin-bottom: 4px; }
details { margin-top: 12px; }
summary { cursor: pointer; }
.history ul { list-style: none; padding: 0; margin: 12px 0; }
.history li + li { margin-top: 6px; }
.history li button { display: flex; justify-content: space-between; gap: 6px 12px; align-items: center; flex-wrap: wrap; width: 100%; text-align: start; }
@media (max-width: 720px) { .arena { grid-template-columns: 1fr; } }
</style>
