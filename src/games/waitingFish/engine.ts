/**
 * 文字钓鱼 · 单机精简引擎
 * 玩法参考 tutusagi/ai-fishing-game（水面买饵/抛竿/卖鱼/换地点/图鉴）
 * 确定性 mulberry32，进度存 localStorage。
 */
import raw from './data'

export type RarityKey = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

export interface FishDef {
  id: string
  name: string
  rarity: RarityKey
  description: string
  size_min: number
  size_max: number
  size_unit: string
  base_value: number
  tags: string[]
  locations: string[]
  seasons: string[]
  individual_weight?: number
}

export interface LocationDef {
  id: string
  name: string
  description: string
  junk_chance_base: number
  tag_weight_mult: Record<string, number>
  unlock_cost: number
  available_seasons: string[]
  ambience: string[]
  character: string
}

export interface BaitDef {
  id: string
  name: string
  cost: number
  description: string
  effects: {
    rarity_weight_mult?: Partial<Record<RarityKey, number>>
    tag_weight_mult?: Record<string, number>
    junk_chance_mult?: number
  }
}

export interface CatchItem {
  instance_id: string
  fish_id: string
  size: number
  value: number
}

export interface EncEntry {
  discovered: boolean
  first_caught_turn: number
  count: number
  max_size: number
  total_value_earned: number
}

export interface GameState {
  version: number
  seed: number
  rngState: number
  rngCalls: number
  turn: number
  season_id: string
  season_length: number
  season_started_turn: number
  points: number
  location_id: string
  unlocked_locations: string[]
  bait_inventory: Record<string, number>
  catch_inventory: CatchItem[]
  encyclopedia: Record<string, EncEntry>
  stats: { total_casts: number; total_caught: number }
  local_dry: number
  fever: number
  free_bait: number
  ambience_scene?: string
}

const RARITY = raw.rarity as unknown as Record<
  RarityKey,
  { label: string; tag: string; weight: number; discovery_bonus: number }
>
const SEASONS = raw.seasons as unknown as Record<
  string,
  { id: string; name: string; order: number; description: string; tag_weight_mult: Record<string, number> }
>
const LOCATIONS = raw.locations as unknown as Record<string, LocationDef>
const FISH = raw.fish as unknown as Record<string, FishDef>
const BAITS = raw.baits as unknown as Record<string, BaitDef>

const SAVE_KEY = 'fp_waiting_fish_v1'
const JUNK = ['一只灌满水的破靴子', '半截生锈的罐头', '一团缠死的旧鱼线', '一块被水磨圆的碎瓷片', '邻居家漂走的塑料小鸭']
const BITE_SOFT = ['浮标轻轻一沉——', '水面咕咚一声，浮标没了影——', '线微微一紧，有动静——']
const BITE_HARD = ['线猛地绷紧，差点脱手——！', '竿梢狠狠一弯，水花炸开——！', '一股大力往下死拽，险些握不住——！']
const LUCK_CHANCE = 0.05
const FEVER_CASTS = 3
const FREE_BAIT_CASTS = 3
const LUCK_EVENTS = [
  { id: 'split_hook', weight: 28 },
  { id: 'golden_touch', weight: 24 },
  { id: 'fever', weight: 16 },
  { id: 'river_blessing', weight: 16 },
  { id: 'tide_record', weight: 8 },
  { id: 'lucky_pearl', weight: 8 },
] as const

const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter']

class Rng {
  state: number
  calls: number
  constructor(state: number, calls = 0) {
    this.state = state >>> 0
    this.calls = calls
  }
  random() {
    this.calls += 1
    let a = (this.state + 0x6d2b79f5) >>> 0
    this.state = a
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    t >>>= 0
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  rint(a: number, b: number) {
    return a + Math.floor(this.random() * (b - a + 1))
  }
}

function newState(seed = 0x9e3779b9): GameState {
  const s = seed >>> 0
  return {
    version: 1,
    seed: s,
    rngState: s,
    rngCalls: 0,
    turn: 0,
    season_id: 'spring',
    season_length: 20,
    season_started_turn: 0,
    points: 200,
    location_id: 'moonlit_pond',
    unlocked_locations: ['moonlit_pond', 'reed_river'],
    bait_inventory: { basic_worm: 5 },
    catch_inventory: [],
    encyclopedia: {},
    stats: { total_casts: 0, total_caught: 0 },
    local_dry: 0,
    fever: 0,
    free_bait: 0,
  }
}

function loadState(): GameState {
  try {
    if (typeof localStorage === 'undefined') return newState()
    const rawSave = localStorage.getItem(SAVE_KEY)
    if (!rawSave) return newState()
    const parsed = JSON.parse(rawSave) as GameState
    if (!parsed || typeof parsed !== 'object') return newState()
    return { ...newState(parsed.seed), ...parsed }
  } catch {
    return newState()
  }
}

function saveState(S: GameState) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(SAVE_KEY, JSON.stringify(S))
  } catch {
    /* ignore quota */
  }
}

function eligible(f: FishDef, locId: string, seaId: string) {
  const lo = f.locations.includes('all') || f.locations.includes(locId)
  const so = f.seasons.includes('all') || f.seasons.includes(seaId)
  return lo && so
}

function effWeight(f: FishDef, locId: string, seaId: string, baitId: string) {
  const loc = LOCATIONS[locId]
  const sea = SEASONS[seaId]
  const bait = BAITS[baitId]
  let w = RARITY[f.rarity].weight * (f.individual_weight ?? 1)
  for (const tag of f.tags || []) {
    w *= loc.tag_weight_mult?.[tag] ?? 1
    w *= sea.tag_weight_mult?.[tag] ?? 1
    w *= bait.effects.tag_weight_mult?.[tag] ?? 1
  }
  w *= bait.effects.rarity_weight_mult?.[f.rarity] ?? 1
  return w
}

function wpick<T>(rng: Rng, items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rng.random() * total
  let up = 0
  for (let i = 0; i < items.length; i++) {
    up += weights[i]
    if (r <= up) return items[i]
  }
  return items[items.length - 1]
}

function rollSize(rng: Rng, f: FishDef) {
  const a = f.size_min
  const b = f.size_max
  let base = a + ((b - a) * (rng.random() + rng.random())) / 2
  if (rng.random() < 0.03) base = b - (b - base) * rng.random() * 0.3
  return Math.round(base * 10) / 10
}

function valueOf(f: FishDef, size: number) {
  const mid = (f.size_min + f.size_max) / 2
  return Math.max(1, Math.round(f.base_value * (size / mid) ** 1.5))
}

function updEnc(S: GameState, f: FishDef, size: number, value: number) {
  const first = !(f.id in S.encyclopedia)
  if (first) {
    S.encyclopedia[f.id] = {
      discovered: true,
      first_caught_turn: S.turn,
      count: 0,
      max_size: 0,
      total_value_earned: 0,
    }
  }
  const e = S.encyclopedia[f.id]
  e.count += 1
  e.max_size = Math.max(e.max_size, size)
  e.total_value_earned += value
  return first
}

function advSeason(S: GameState) {
  if (S.turn - S.season_started_turn < S.season_length) return ''
  const idx = SEASON_ORDER.indexOf(S.season_id)
  const next = SEASON_ORDER[(idx + 1) % SEASON_ORDER.length]
  S.season_id = next
  S.season_started_turn = S.turn
  const sea = SEASONS[next]
  return `\n🍂 季节流转：进入【${sea.name}】——${sea.description}`
}

function biteLine(rng: Rng, rarity: RarityKey) {
  const pool = ['rare', 'epic', 'legendary', 'mythic'].includes(rarity) ? BITE_HARD : BITE_SOFT
  return pool[rng.rint(0, pool.length - 1)]
}

function ambience(S: GameState, loc: LocationDef, rng: Rng) {
  const key = `${S.location_id}|${S.season_id}`
  if (S.ambience_scene === key) return ''
  S.ambience_scene = key
  if (!loc.ambience?.length) return ''
  return `\n（${loc.ambience[rng.rint(0, loc.ambience.length - 1)]}）`
}

function formatCatch(f: FishDef, size: number, value: number, first: boolean) {
  const u = f.size_unit
  const rl = RARITY[f.rarity].label
  const flavor = f.description || ''
  if (f.rarity === 'legendary' || f.rarity === 'mythic') {
    const top =
      f.rarity === 'legendary' ? '👑 ─── 传 说 ─── 👑' : '✧ ────── ❖ 神 话 ❖ ────── ✧'
    const nm = first ? `（★首次收录 +${RARITY[f.rarity].discovery_bonus}点）` : ''
    return `${top}\n${f.name} · ${size}${u} · ${value}点${nm}\n${flavor}`
  }
  if (first) {
    return `🆕 ${f.name} · ${rl} · ${size}${u} · ${value}点\n${flavor}\n首次收录 +${RARITY[f.rarity].discovery_bonus}点`
  }
  if (f.rarity === 'rare' || f.rarity === 'epic') {
    const tag = f.rarity === 'epic' ? '✦✦ 史诗' : '✦ 稀有'
    return `${tag} ${f.name} · ${size}${u} · ${value}点\n${flavor}`
  }
  return `· ${f.name}${f.rarity === 'uncommon' ? '（少见）' : ''} ${size}${u} +${value}`
}

function recordCatch(S: GameState, f: FishDef, size: number, value: number) {
  const inst = `c_${String(S.stats.total_caught + 1).padStart(3, '0')}`
  S.catch_inventory.push({ instance_id: inst, fish_id: f.id, size, value })
  S.stats.total_caught += 1
  const first = updEnc(S, f, size, value)
  const bonus = first ? RARITY[f.rarity].discovery_bonus : 0
  if (bonus) S.points += bonus
  return { inst, first, bonus }
}

function milestone(S: GameState, f: FishDef, first: boolean) {
  if (!first) return ''
  const got = Object.keys(S.encyclopedia).length
  const total = Object.keys(FISH).length
  if (got >= total) return `\n🎉🎉 全图鉴收集完成！${total} 种鱼悉数收录。`
  const tier = Object.values(FISH).filter((x) => x.rarity === f.rarity)
  if (tier.length && tier.every((x) => x.id in S.encyclopedia)) {
    return `\n🎉 「${RARITY[f.rarity].label}」鱼已集齐！(${tier.length} 种)`
  }
  if (got % 10 === 0) return `\n🎉 图鉴达成 ${got}/${total} 种！`
  return ''
}

function pickByWeight<T extends { weight: number; id: string }>(rng: Rng, arr: readonly T[]) {
  return wpick(
    rng,
    [...arr],
    arr.map((x) => x.weight),
  )
}

function rollLuck(
  S: GameState,
  rng: Rng,
  pool: FishDef[],
  baitId: string,
  f: FishDef,
  inst: string,
): string {
  if (rng.random() >= LUCK_CHANCE) return ''
  const eid = pickByWeight(rng, LUCK_EVENTS).id
  if (eid === 'split_hook') {
    const weights = pool.map((g) => effWeight(g, S.location_id, S.season_id, baitId))
    const got: string[] = []
    for (let i = 0; i < 2; i++) {
      const g = wpick(rng, pool, weights)
      const gs = rollSize(rng, g)
      const gv = valueOf(g, gs)
      const { first } = recordCatch(S, g, gs, gv)
      got.push(`${g.name}${first ? '★新' : ''} ${gs}${g.size_unit}`)
    }
    return `🪝✨ 分裂鱼钩！又拽上来两条：${got.join('、')}`
  }
  if (eid === 'golden_touch') {
    const c = S.catch_inventory.find((x) => x.instance_id === inst)
    if (!c) return ''
    const old = c.value
    c.value = old * 3
    return `✨💰 点石成金！价值 ×3：${old} → ${c.value} 点`
  }
  if (eid === 'fever') {
    S.fever += FEVER_CASTS
    return `🔥 渔获热潮！接下来 ${FEVER_CASTS} 条鱼都会翻倍。`
  }
  if (eid === 'river_blessing') {
    if (baitId) S.bait_inventory[baitId] = (S.bait_inventory[baitId] || 0) + 1
    S.free_bait += FREE_BAIT_CASTS
    return `🌊🙏 河神的祝福！退还这一竿的饵，接下来 ${FREE_BAIT_CASTS} 竿不耗鱼饵。`
  }
  if (eid === 'tide_record') {
    const c = S.catch_inventory.find((x) => x.instance_id === inst)
    if (!c) return ''
    const rs = f.size_max
    const rv = valueOf(f, rs)
    const e = S.encyclopedia[f.id]
    if (e) {
      e.max_size = Math.max(e.max_size, rs)
      e.total_value_earned += Math.max(0, rv - c.value)
    }
    c.size = rs
    c.value = rv
    return `🌊📏 千载难逢的涨潮！涨到极限 ${rs}${f.size_unit}，价值 ${rv} 点。`
  }
  if (eid === 'lucky_pearl') {
    const bonus = 30 + rng.rint(0, 70)
    S.points += bonus
    return `🦪✨ 蚌中生珠！鱼肚里滚出财宝，换得 ${bonus} 点。`
  }
  return ''
}

function castStep(S: GameState, rng: Rng, baitId?: string) {
  const inv = S.bait_inventory
  let bid = baitId || ''
  if (!bid) {
    const avail = Object.keys(inv).filter((b) => (inv[b] || 0) > 0)
    if (!avail.length) {
      return { text: '没有鱼饵了！去商店买点饵再来。', ok: false }
    }
    bid = avail.sort((a, b) => BAITS[a].cost - BAITS[b].cost)[0]
  }
  if (!BAITS[bid]) return { text: `没有这种鱼饵：${bid}`, ok: false }
  if ((inv[bid] || 0) <= 0) return { text: `${BAITS[bid].name} 用光了。换一种或去商店买。`, ok: false }

  if (S.free_bait > 0) S.free_bait -= 1
  else inv[bid] -= 1

  S.turn += 1
  S.stats.total_casts += 1
  const seasonMsg = advSeason(S)
  const loc = LOCATIONS[S.location_id]
  const junkChance = loc.junk_chance_base * (BAITS[bid].effects.junk_chance_mult ?? 1)
  if (rng.random() < junkChance) {
    S.local_dry += 1
    return {
      text: `${seasonMsg}🪣 ${JUNK[rng.rint(0, JUNK.length - 1)]}。空军一竿。${ambience(S, loc, rng)}`,
      ok: true,
      kind: 'junk' as const,
    }
  }

  const pool = Object.values(FISH).filter((f) => eligible(f, S.location_id, S.season_id))
  if (!pool.length) {
    S.local_dry += 1
    return {
      text: `${seasonMsg}浮标纹丝不动……这个季节什么都没咬钩。${ambience(S, loc, rng)}`,
      ok: true,
      kind: 'empty' as const,
    }
  }

  const weights = pool.map((f) => effWeight(f, S.location_id, S.season_id, bid))
  const f = wpick(rng, pool, weights)
  const size = rollSize(rng, f)
  let value = valueOf(f, size)
  biteLine(rng, f.rarity) // 消耗一次随机，保持与原引擎节奏接近
  const { inst, first } = recordCatch(S, f, size, value)
  if (first) S.local_dry = 0
  else S.local_dry += 1

  let feverLine = ''
  if (S.fever > 0) {
    S.fever -= 1
    const d = recordCatch(S, f, size, value)
    feverLine = `\n🔥 热潮翻倍：又得一条 ${f.name}${d.first ? '★新' : ''}`
  }

  const luck = rollLuck(S, rng, pool, bid, f, inst)
  const luckSeg = luck ? `\n${luck}` : ''
  return {
    text: `${seasonMsg}${formatCatch(f, size, value, first)}${milestone(S, f, first)}${feverLine}${luckSeg}${ambience(S, loc, rng)}`,
    ok: true,
    kind: 'fish' as const,
    rarity: f.rarity,
    first,
  }
}

function syncRng(S: GameState, rng: Rng) {
  S.rngState = rng.state
  S.rngCalls = rng.calls
}

export function createFishingGame() {
  let S = loadState()

  function persist() {
    saveState(S)
  }

  function statusBar() {
    const loc = LOCATIONS[S.location_id]
    const sea = SEASONS[S.season_id]
    const enc = Object.keys(S.encyclopedia).length
    const total = Object.keys(FISH).length
    const baitLeft = Object.values(S.bait_inventory).reduce((a, b) => a + (b || 0), 0)
    return {
      points: S.points,
      location: loc.name,
      season: sea.name,
      turn: S.turn,
      enc: `${enc}/${total}`,
      baitLeft,
      catches: S.catch_inventory.length,
      casts: S.stats.total_casts,
    }
  }

  function cmd(input: string): string {
    const line = input.trim()
    if (!line) return '输入指令，或点下面的按钮。试试：cast / shop / sell all / goto'

    const parts = line.split(/\s+/)
    const op = parts[0].toLowerCase()

    if (op === 'help' || op === '?' || op === '帮助') {
      return [
        '🎣 摸鱼等待 · 文字钓鱼（单机）',
        'cast [饵id] [次数] — 抛竿，可连钓最多 10 竿',
        'shop — 商店',
        'buy <饵id> [数量] — 买饵',
        'inv — 渔获 / 饵料',
        'sell all | sell fish — 卖光渔获',
        'goto — 地点列表；goto <id> — 前往/解锁',
        'enc — 图鉴',
        'status — 状态',
        'new — 新开一局（清档）',
        '',
        '灵感来自 tutusagi/ai-fishing-game',
      ].join('\n')
    }

    if (op === 'status' || op === '状态') {
      const b = statusBar()
      const baits =
        Object.entries(S.bait_inventory)
          .filter(([, n]) => n > 0)
          .map(([id, n]) => `${BAITS[id]?.name || id}×${n}`)
          .join('、') || '（没饵了）'
      return `点数 ${b.points} ｜ ${b.location} · ${b.season} ｜ 回合 ${b.turn}\n图鉴 ${b.enc} ｜ 渔获 ${b.catches} ｜ 累计抛竿 ${b.casts}\n饵料：${baits}`
    }

    if (op === 'shop' || op === '商店') {
      return Object.values(BAITS)
        .map((b) => `${b.id}　${b.name}　${b.cost}点\n　${b.description}`)
        .join('\n')
    }

    if (op === 'buy' || op === '买') {
      const baitId = parts[1]
      const qty = Math.max(1, Math.min(50, Number(parts[2]) || 1))
      const bait = BAITS[baitId]
      if (!bait) return `没有这种饵。可用：${Object.keys(BAITS).join('、')}`
      const cost = bait.cost * qty
      if (S.points < cost) return `点数不够：需要 ${cost}，当前 ${S.points}`
      S.points -= cost
      S.bait_inventory[baitId] = (S.bait_inventory[baitId] || 0) + qty
      persist()
      return `买下 ${bait.name}×${qty}（-${cost}点）。剩余 ${S.points} 点。`
    }

    if (op === 'inv' || op === '背包') {
      const baits =
        Object.entries(S.bait_inventory)
          .filter(([, n]) => n > 0)
          .map(([id, n]) => `  ${BAITS[id]?.name || id}×${n}`)
          .join('\n') || '  （空）'
      const fish =
        S.catch_inventory
          .map((c) => {
            const f = FISH[c.fish_id]
            return `  ${c.instance_id}　${f?.name || c.fish_id}　${c.size}${f?.size_unit || 'cm'}　${c.value}点`
          })
          .join('\n') || '  （空）'
      return `🪱 饵料：\n${baits}\n🐟 渔获：\n${fish}`
    }

    if (op === 'sell' || op === '卖') {
      const target = (parts[1] || 'all').toLowerCase()
      if (target === 'all' || target === 'fish' || target === '渔获') {
        if (!S.catch_inventory.length) return '渔获是空的。'
        const sum = S.catch_inventory.reduce((a, c) => a + c.value, 0)
        const n = S.catch_inventory.length
        S.catch_inventory = []
        S.points += sum
        persist()
        return `卖掉 ${n} 条渔获，收入 ${sum} 点。当前 ${S.points} 点。`
      }
      return '用法：sell all'
    }

    if (op === 'goto' || op === '去') {
      if (!parts[1]) {
        return Object.values(LOCATIONS)
          .sort((a, b) => a.unlock_cost - b.unlock_cost)
          .map((l) => {
            const unlocked = S.unlocked_locations.includes(l.id)
            const here = S.location_id === l.id ? ' ◀' : ''
            const cost = unlocked ? '已解锁' : `${l.unlock_cost}点解锁`
            const open = l.available_seasons.map((s) => SEASONS[s]?.name || s).join('')
            return `${l.id}　${l.name}　${cost}${here}\n　开放：${open}　${l.character}`
          })
          .join('\n')
      }
      const loc = LOCATIONS[parts[1]] || Object.values(LOCATIONS).find((l) => l.name === parts[1])
      if (!loc) return '没有这个地点。先 goto 看列表。'
      if (!S.unlocked_locations.includes(loc.id)) {
        if (S.points < loc.unlock_cost) return `解锁【${loc.name}】需要 ${loc.unlock_cost} 点，当前 ${S.points}`
        S.points -= loc.unlock_cost
        S.unlocked_locations.push(loc.id)
      }
      if (!loc.available_seasons.includes(S.season_id)) {
        return `【${loc.name}】当前季节未开放（现为${SEASONS[S.season_id].name}）。点数已扣的解锁仍保留。`
      }
      S.location_id = loc.id
      S.ambience_scene = undefined
      persist()
      return `来到【${loc.name}】。\n${loc.description}`
    }

    if (op === 'enc' || op === '图鉴') {
      const total = Object.keys(FISH).length
      const got = Object.keys(S.encyclopedia).length
      const lines = Object.values(FISH)
        .filter((f) => f.id in S.encyclopedia)
        .map((f) => {
          const e = S.encyclopedia[f.id]
          return `  ${RARITY[f.rarity].tag} ${f.name}　×${e.count}　最大${e.max_size}${f.size_unit}`
        })
      return `图鉴 ${got}/${total}\n${lines.join('\n') || '（还是空白，去抛竿吧）'}`
    }

    if (op === 'cast' || op === '抛' || op === '钓') {
      let baitId: string | undefined
      let times = 1
      if (parts[1] && BAITS[parts[1]]) {
        baitId = parts[1]
        times = Math.max(1, Math.min(10, Number(parts[2]) || 1))
      } else if (parts[1] && /^\d+$/.test(parts[1])) {
        times = Math.max(1, Math.min(10, Number(parts[1])))
      }
      const rng = new Rng(S.rngState, S.rngCalls)
      if (times === 1) {
        const r = castStep(S, rng, baitId)
        syncRng(S, rng)
        persist()
        return r.text
      }
      const texts: string[] = []
      let fish = 0
      let junk = 0
      let news = 0
      for (let i = 0; i < times; i++) {
        const r = castStep(S, rng, baitId)
        if (!r.ok) {
          texts.push(r.text)
          break
        }
        if (r.kind === 'fish') {
          fish += 1
          if (r.first) news += 1
          if (r.rarity === 'legendary' || r.rarity === 'mythic' || r.first) texts.push(r.text)
        } else junk += 1
      }
      syncRng(S, rng)
      persist()
      const summary = `—— 连钓 ${times} 竿：上钩 ${fish}，空军 ${junk}，新种 ${news} ——`
      return texts.length ? `${texts.join('\n\n')}\n\n${summary}` : summary
    }

    if (op === 'new' || op === '重开' || op === 'newgame') {
      const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0
      S = newState(seed)
      persist()
      return `新的一局开始了（seed ${seed}）。200 点 + 普通蚯蚓×5，人在月光池塘。`
    }

    return `不懂「${line}」。输入 help 看指令，或点下方按钮。`
  }

  function reset() {
    return cmd('new')
  }

  return {
    cmd,
    reset,
    statusBar,
    getState: () => S,
    catalog: { FISH, BAITS, LOCATIONS, SEASONS, RARITY },
  }
}

export type FishingGame = ReturnType<typeof createFishingGame>
