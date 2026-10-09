/** Canvas 猫钓鱼：第一人称俯视水面，只见鱼儿与猫爪；含图鉴 / 商城 */

export { FISH_KINDS, type FishKind, type Rarity } from './fishKinds'
import { drawFishForm } from './fishArt'
import { FISH_KINDS, type FishKind, type Rarity } from './fishKinds'

export type EncEntry = {
  discovered: boolean
  count: number
  bestPoints: number
}

export type ShopItem = {
  id: string
  name: string
  desc: string
  cost: number
  /** 增加的普通饵数量 */
  bait: number
  /** 闪光饵次数（提高稀有权重） */
  lucky: number
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'bait_5', name: '蚯蚓×5', desc: '基础鱼饵，够摸几竿', cost: 25, bait: 5, lucky: 0 },
  { id: 'bait_12', name: '蚯蚓补给×12', desc: '划算的大包装', cost: 50, bait: 12, lucky: 0 },
  { id: 'lucky_3', name: '闪光饵×3', desc: '接下来 3 次抛竿，稀有更容易上钩', cost: 80, bait: 0, lucky: 3 },
  { id: 'combo', name: '摸鱼套装', desc: '饵×10 + 闪光×2', cost: 90, bait: 10, lucky: 2 },
]

const DISCOVERY_BONUS: Record<Rarity, number> = {
  常见: 10,
  少见: 20,
  稀有: 40,
  史诗: 60,
  传说: 80,
  神话: 120,
}

type SwimFish = {
  kind: FishKind
  x: number
  y: number
  vx: number
  phase: number
  caught: boolean
}

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; r: number }

type Phase = 'ready' | 'cast' | 'wait' | 'bite' | 'reel' | 'miss' | 'catch'

const SAVE_KEY = 'fp_canvas_fish_v2'

export type GameHud = {
  score: number
  catches: number
  best: number
  bait: number
  lucky: number
  encFound: number
  encTotal: number
  message: string
  lastCatch: string
  phase: Phase
  encyclopedia: Record<string, EncEntry>
}

type SaveData = {
  score: number
  catches: number
  best: number
  bait: number
  lucky: number
  encyclopedia: Record<string, EncEntry>
}

function emptyEnc(): Record<string, EncEntry> {
  return {}
}

function loadSave(): SaveData {
  const fallback: SaveData = { score: 0, catches: 0, best: 0, bait: 12, lucky: 0, encyclopedia: emptyEnc() }
  try {
    if (typeof localStorage === 'undefined') return fallback
    const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem('fp_canvas_fish_v1')
    if (!raw) return fallback
    const j = JSON.parse(raw) as Partial<SaveData>
    const encyclopedia: Record<string, EncEntry> = {}
    if (j.encyclopedia && typeof j.encyclopedia === 'object') {
      for (const [id, e] of Object.entries(j.encyclopedia)) {
        if (!e || typeof e !== 'object') continue
        encyclopedia[id] = {
          discovered: !!e.discovered,
          count: Number(e.count) || 0,
          bestPoints: Number(e.bestPoints) || 0,
        }
      }
    }
    return {
      score: Number(j.score) || 0,
      catches: Number(j.catches) || 0,
      best: Number(j.best) || 0,
      bait: Math.max(0, Number(j.bait) || 12),
      lucky: Math.max(0, Number(j.lucky) || 0),
      encyclopedia,
    }
  } catch {
    return fallback
  }
}

function saveSave(s: SaveData) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(SAVE_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

function pickKind(luckyBoost: boolean): FishKind {
  const mult: Partial<Record<Rarity, number>> = luckyBoost
    ? { 少见: 1.4, 稀有: 1.8, 史诗: 2.2, 传说: 2.5, 神话: 3 }
    : {}
  let total = 0
  const weights = FISH_KINDS.map((k) => {
    const w = k.weight * (mult[k.rarity] ?? 1)
    total += w
    return w
  })
  let r = Math.random() * total
  for (let i = 0; i < FISH_KINDS.length; i++) {
    r -= weights[i]
    if (r <= 0) return FISH_KINDS[i]
  }
  return FISH_KINDS[0]
}

/** logo-data.json 里拆出的原图（与站点 LogoMark 同源） */
export const LOGO_ASSETS = {
  fish: '/images/waitingFish/fish.png',
  cat: '/images/waitingFish/cat.png',
} as const

type LogoImgs = { fish: HTMLImageElement; cat: HTMLImageElement }

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`load ${src}`))
    img.src = src
  })
}

function drawBobber(ctx: CanvasRenderingContext2D, x: number, y: number, bite: boolean, t: number) {
  const bob = bite ? Math.sin(t * 28) * 4 : Math.sin(t * 3) * 1.5
  ctx.save()
  ctx.translate(x, y + bob)
  ctx.fillStyle = '#e74c3c'
  ctx.beginPath()
  ctx.ellipse(0, -4, 6, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.ellipse(0, 4, 6, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(0, 0, 7, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

export function createCanvasFishGame(canvas: HTMLCanvasElement, onHud: (h: GameHud) => void) {
  const ctx = canvas.getContext('2d')!
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  let W = 640
  let H = 360
  /** 水面几乎铺满：第一人称趴在池边往下看 */
  let waterY = 36
  let running = false
  let raf = 0
  let t0 = performance.now()
  let time = 0
  let imgs: LogoImgs | null = null

  const saved = loadSave()
  let score = saved.score
  let catches = saved.catches
  let best = saved.best
  let bait = saved.bait
  let lucky = saved.lucky
  let encyclopedia: Record<string, EncEntry> = { ...saved.encyclopedia }
  let message = '点击水面或按「抛竿」开始'
  let lastCatch = ''
  let phase: Phase = 'ready'

  const fishes: SwimFish[] = []
  const particles: Particle[] = []
  let hookX = 0
  let hookY = 0
  let castProgress = 0
  let biteTimer = 0
  let biteWindow = 0
  let biteFish: SwimFish | null = null
  let resultTimer = 0
  let tipPulse = 0
  /** 本竿是否消耗了闪光饵（影响等待期间刷鱼稀有度） */
  let castLucky = false
  let castAimX = 0
  let castAimY = 0

  /** 派派鱼：直接画 logo 的 fish.png + cat.png */
  function drawLogoFishSprite(f: SwimFish, t: number) {
    if (!imgs?.fish.complete) return
    const size = 52 * f.kind.size
    // 素材朝左，vx>0 向右游时翻转
    const face = f.vx >= 0 ? -1 : 1
    const wag = Math.sin(t * 8 + f.phase) * 0.1
    ctx.save()
    ctx.translate(f.x, f.y)
    ctx.scale(face, 1)
    ctx.rotate(wag)
    ctx.drawImage(imgs.fish, -size * 0.5, -size * 0.42, size, size)
    if (imgs.cat.complete) {
      const cs = size * 0.48
      ctx.drawImage(imgs.cat, -cs * 0.35, -size * 0.62, cs, cs)
    }
    ctx.restore()
  }

  function drawFish(f: SwimFish, t: number) {
    if (f.kind.id === 'logo') {
      drawLogoFishSprite(f, t)
      return
    }
    ctx.save()
    ctx.translate(f.x, f.y)
    // drawFishForm 本地头朝 +x；vx>0 向右游
    drawFishForm(ctx, f.kind, {
      scale: f.kind.size,
      face: f.vx >= 0 ? 1 : -1,
      t,
      phase: f.phase,
    })
    ctx.restore()
  }

  /** 猫爪：直接画 logo 的 cat.png */
  function drawLogoPaw(x: number, y: number, scale: number, flip: boolean, reach: number, t: number) {
    if (!imgs?.cat.complete) return
    const bob = Math.sin(t * 2.2) * 1.2
    ctx.save()
    ctx.translate(x, y + bob - reach * 28)
    ctx.scale(flip ? -scale : scale, scale)
    ctx.rotate((-0.06 + reach * 0.08) * (flip ? -1 : 1))
    const paw = 96
    ctx.drawImage(imgs.cat, -paw * 0.5, -paw * 0.55, paw, paw)
    ctx.restore()
  }

  function encFound() {
    return FISH_KINDS.filter((k) => encyclopedia[k.id]?.discovered).length
  }

  function emitHud() {
    onHud({
      score,
      catches,
      best,
      bait,
      lucky,
      encFound: encFound(),
      encTotal: FISH_KINDS.length,
      message,
      lastCatch,
      phase,
      encyclopedia: { ...encyclopedia },
    })
  }

  function persist() {
    best = Math.max(best, score)
    saveSave({ score, catches, best, bait, lucky, encyclopedia })
  }

  /** 持竿爪尖（线的起点） */
  function pawTip() {
    return { x: W * 0.58, y: H - 36 }
  }

  /** 爪前可活动的水域下沿（避开前景爪） */
  function fishFloor() {
    return H - 88
  }

  function resize() {
    const parent = canvas.parentElement
    const cssW = Math.max(280, parent?.clientWidth || 640)
    const cssH = Math.round(cssW * 0.56)
    W = cssW
    H = Math.max(220, Math.min(380, cssH))
    waterY = Math.max(28, H * 0.1)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function spawnFish() {
    while (fishes.filter((f) => !f.caught).length < 7) {
      const kind = pickKind(castLucky || lucky > 0)
      const fromLeft = Math.random() < 0.5
      const floor = fishFloor()
      fishes.push({
        kind,
        x: fromLeft ? -40 : W + 40,
        y: waterY + 36 + Math.random() * Math.max(40, floor - waterY - 50),
        vx:
          (fromLeft ? 1 : -1) *
          (0.4 + Math.random() * 0.9) *
          (kind.rarity === '传说' || kind.rarity === '神话' ? 1.4 : kind.rarity === '史诗' ? 1.2 : 1),
        phase: Math.random() * Math.PI * 2,
        caught: false,
      })
    }
  }

  function resetHook() {
    const tip = pawTip()
    hookX = tip.x
    hookY = tip.y - 10
    castProgress = 0
    biteFish = null
    biteTimer = 0
    biteWindow = 0
  }

  function cast() {
    if (phase !== 'ready' && phase !== 'miss' && phase !== 'catch') return
    if (bait <= 0) {
      message = '没有鱼饵了，去「商城」买一点'
      emitHud()
      return
    }
    bait -= 1
    castLucky = lucky > 0
    if (castLucky) lucky -= 1
    phase = 'cast'
    castProgress = 0
    castAimX = W * 0.32 + Math.random() * W * 0.36
    castAimY = waterY + 10 + Math.random() * 16
    const tip = pawTip()
    hookX = tip.x
    hookY = tip.y - 8
    message = castLucky ? `抛竿中…（闪光剩余 ${lucky}）` : '抛竿中…'
    tipPulse = 0
    // 闪光竿立刻补几条偏稀有的鱼
    if (castLucky) {
      const floor = fishFloor()
      for (let i = 0; i < 3; i++) {
        const kind = pickKind(true)
        const fromLeft = Math.random() < 0.5
        fishes.push({
          kind,
          x: fromLeft ? -40 : W + 40,
          y: waterY + 36 + Math.random() * Math.max(40, floor - waterY - 50),
          vx: (fromLeft ? 1 : -1) * (0.5 + Math.random() * 1.1),
          phase: Math.random() * Math.PI * 2,
          caught: false,
        })
      }
    }
    persist()
    emitHud()
  }

  function tryReel() {
    if (phase === 'ready') {
      cast()
      return
    }
    if (phase === 'wait') {
      // early reel — miss
      phase = 'miss'
      resultTimer = 0.9
      message = '太早收竿了，空军～'
      emitHud()
      return
    }
    if (phase === 'bite') {
      const progress = 1 - biteTimer / biteWindow
      // sweet spot mid window
      const good = progress > 0.2 && progress < 0.85
      if (good && biteFish) {
        phase = 'catch'
        resultTimer = 1.4
        const k = biteFish.kind
        const pts = k.points + Math.round(Math.random() * 6)
        const first = !encyclopedia[k.id]?.discovered
        let bonus = 0
        if (first) {
          bonus = DISCOVERY_BONUS[k.rarity]
          encyclopedia[k.id] = { discovered: true, count: 0, bestPoints: 0 }
        }
        const entry = encyclopedia[k.id]
        entry.count += 1
        entry.bestPoints = Math.max(entry.bestPoints, pts)
        score += pts + bonus
        catches += 1
        lastCatch = `${k.rarity} · ${k.name} +${pts}`
        message = first
          ? `图鉴解锁！${k.name}（首获 +${bonus}）· ${lastCatch}`
          : `钓到了！${lastCatch}`
        biteFish.caught = true
        for (let i = 0; i < 14; i++) {
          particles.push({
            x: hookX,
            y: hookY,
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 3 - 1,
            life: 0.6 + Math.random() * 0.5,
            color: k.color,
            r: 2 + Math.random() * 3,
          })
        }
        persist()
      } else {
        phase = 'miss'
        resultTimer = 0.9
        message = '跑了，再试一次'
        if (biteFish) biteFish.vx *= 2.2
      }
      emitHud()
      return
    }
  }

  function buyShopItem(id: string): boolean {
    const item = SHOP_ITEMS.find((s) => s.id === id)
    if (!item) {
      message = '商品不存在'
      emitHud()
      return false
    }
    if (score < item.cost) {
      message = `积分不够，还差 ${item.cost - score}`
      emitHud()
      return false
    }
    if (bait + item.bait > 60) {
      message = '鱼饵太多了，先用一些再买'
      emitHud()
      return false
    }
    score -= item.cost
    bait += item.bait
    lucky += item.lucky
    message =
      item.lucky > 0
        ? `买下「${item.name}」· 饵 ${bait} · 闪光 ${lucky}`
        : `买下「${item.name}」· 当前饵 ${bait}`
    persist()
    emitHud()
    return true
  }

  function newGame() {
    score = 0
    catches = 0
    bait = 12
    lucky = 0
    lastCatch = ''
    message = '新的一局（图鉴保留）'
    phase = 'ready'
    fishes.length = 0
    particles.length = 0
    resetHook()
    spawnFish()
    persist()
    emitHud()
  }

  function update(dt: number) {
    time += dt
    tipPulse += dt
    spawnFish()

    for (const f of fishes) {
      if (f.caught) continue
      f.x += f.vx * 60 * dt
      f.y += Math.sin(time * 2 + f.phase) * 0.25
      if (f.x < -60 || f.x > W + 60) {
        f.vx *= -1
        f.x = Math.max(-50, Math.min(W + 50, f.x))
      }
      f.y = Math.min(fishFloor(), Math.max(waterY + 24, f.y))
    }
    for (let i = fishes.length - 1; i >= 0; i--) {
      if (fishes[i].caught) fishes.splice(i, 1)
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.life -= dt
      p.x += p.vx
      p.y += p.vy
      p.vy += 8 * dt
      if (p.life <= 0) particles.splice(i, 1)
    }

    if (phase === 'cast') {
      castProgress = Math.min(1, castProgress + dt * 1.8)
      const tip = pawTip()
      const p = castProgress * castProgress
      hookX = tip.x + (castAimX - tip.x) * p
      hookY = tip.y - 8 + (castAimY - (tip.y - 8)) * p
      if (castProgress >= 1) {
        hookX = castAimX
        hookY = castAimY
        phase = 'wait'
        biteTimer = 0.8 + Math.random() * 2.2
        message = '浮标荡着…屏住呼吸'
        emitHud()
      }
    } else if (phase === 'wait') {
      biteTimer -= dt
      // attract nearest fish
      let nearest: SwimFish | null = null
      let bestD = 9999
      for (const f of fishes) {
        if (f.caught) continue
        const d = Math.hypot(f.x - hookX, f.y - (hookY + 30))
        if (d < bestD) {
          bestD = d
          nearest = f
        }
      }
      if (nearest && bestD < 120) {
        nearest.vx += (hookX - nearest.x) * 0.002
        nearest.y += (hookY + 28 - nearest.y) * 0.02
      }
      if (biteTimer <= 0 && nearest && bestD < 90) {
        phase = 'bite'
        biteFish = nearest
        biteWindow = 0.85 + Math.random() * 0.35
        biteTimer = biteWindow
        message = '有鱼咬钩了！快点收竿！'
        emitHud()
      } else if (biteTimer <= 0) {
        biteTimer = 0.6 + Math.random() * 1.5
      }
    } else if (phase === 'bite') {
      biteTimer -= dt
      tipPulse += dt * 4
      if (biteFish) {
        biteFish.x += (hookX - biteFish.x) * 0.08
        biteFish.y += (hookY + 22 - biteFish.y) * 0.08
      }
      if (biteTimer <= 0) {
        phase = 'miss'
        resultTimer = 0.9
        message = '慢了一步，鱼跑了'
        if (biteFish) biteFish.vx *= -1.8
        biteFish = null
        emitHud()
      }
    } else if (phase === 'miss' || phase === 'catch') {
      resultTimer -= dt
      if (resultTimer <= 0) {
        phase = 'ready'
        castLucky = false
        resetHook()
        message = '点击抛竿继续'
        emitHud()
      }
    }
  }

  function drawPoolEdge() {
    // 池沿木板
    const g = ctx.createLinearGradient(0, 0, 0, waterY)
    g.addColorStop(0, '#2a1e14')
    g.addColorStop(1, '#4a3424')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, waterY)
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    for (let i = 0; i < 8; i++) {
      ctx.fillRect((W / 8) * i + 2, 4, 2, waterY - 8)
    }
    ctx.strokeStyle = 'rgba(255,220,160,0.15)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, waterY - 1)
    ctx.lineTo(W, waterY - 1)
    ctx.stroke()
  }

  function drawWater() {
    const g = ctx.createLinearGradient(0, waterY, 0, H)
    g.addColorStop(0, '#2a7a96')
    g.addColorStop(0.35, '#1a5a72')
    g.addColorStop(0.75, '#124456')
    g.addColorStop(1, '#0a2838')
    ctx.fillStyle = g
    ctx.fillRect(0, waterY, W, H - waterY)

    // depth vignette（第一人称往下看）
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.1, W * 0.5, H * 0.5, H * 0.75)
    vg.addColorStop(0, 'rgba(80,180,210,0.08)')
    vg.addColorStop(1, 'rgba(0,20,40,0.35)')
    ctx.fillStyle = vg
    ctx.fillRect(0, waterY, W, H - waterY)

    ctx.strokeStyle = 'rgba(160,220,255,0.14)'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      const yy = waterY + 24 + i * 26
      for (let x = 0; x <= W; x += 8) {
        const y = yy + Math.sin(x * 0.03 + time * 1.8 + i) * 4
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    ctx.strokeStyle = 'rgba(200,240,255,0.4)'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = 0; x <= W; x += 6) {
      const y = waterY + Math.sin(x * 0.04 + time * 2.5) * 2.5
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  function drawLine() {
    const tip = pawTip()
    const active = phase === 'cast' || phase === 'wait' || phase === 'bite'
    if (!active && phase !== 'catch') return

    ctx.strokeStyle = phase === 'bite' ? 'rgba(255,220,160,0.85)' : 'rgba(230,236,245,0.65)'
    ctx.lineWidth = phase === 'bite' ? 1.6 : 1.2
    ctx.beginPath()
    ctx.moveTo(tip.x, tip.y - 8)
    ctx.quadraticCurveTo(tip.x + (hookX - tip.x) * 0.4, tip.y - 40, hookX, Math.min(hookY, waterY + 2))
    if (hookY > waterY) ctx.lineTo(hookX, hookY)
    ctx.stroke()

    if (hookY >= waterY - 2) {
      drawBobber(ctx, hookX, Math.max(waterY + 2, Math.min(hookY, fishFloor() - 10)), phase === 'bite', time)
      if (hookY > waterY + 8) {
        ctx.strokeStyle = 'rgba(200,200,200,0.35)'
        ctx.setLineDash([3, 4])
        ctx.beginPath()
        ctx.moveTo(hookX, waterY + 8)
        ctx.lineTo(hookX, Math.min(hookY + 18, fishFloor()))
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = '#888'
        ctx.beginPath()
        ctx.moveTo(hookX - 3, Math.min(hookY + 18, fishFloor()))
        ctx.lineTo(hookX + 3, Math.min(hookY + 18, fishFloor()))
        ctx.lineTo(hookX, Math.min(hookY + 26, fishFloor() + 6))
        ctx.fill()
      }
    }
  }

  function drawBiteMeter() {
    if (phase !== 'bite') return
    const progress = 1 - biteTimer / biteWindow
    const mw = 120
    const mh = 10
    const mx = hookX - mw / 2
    const my = Math.max(waterY + 8, hookY - 40)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4)
    ctx.fillStyle = '#333'
    ctx.fillRect(mx, my, mw, mh)
    ctx.fillStyle = 'rgba(80,200,120,0.55)'
    ctx.fillRect(mx + mw * 0.2, my, mw * 0.65, mh)
    ctx.fillStyle = '#f0c040'
    ctx.fillRect(mx + mw * progress - 2, my - 2, 4, mh + 4)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px system-ui,sans-serif'
    ctx.textAlign = 'center'
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(tipPulse * 10)
    ctx.fillText('收竿！', hookX, my - 10)
    ctx.globalAlpha = 1
  }

  function drawPaws() {
    let reach = 0.18
    if (phase === 'cast') reach = 0.4 + castProgress * 0.55
    else if (phase === 'wait') reach = 0.5 + Math.sin(time * 3) * 0.04
    else if (phase === 'bite') reach = 0.75 + Math.sin(tipPulse * 12) * 0.08
    else if (phase === 'catch') reach = 0.9
    else if (phase === 'miss') reach = 0.25

    const tip = pawTip()
    drawLogoPaw(W * 0.2, H - 8, 1.05, true, 0.2 + Math.sin(time * 1.5) * 0.03, time)
    drawLogoPaw(tip.x + 6, H - 6, 1.15, false, reach, time + 1)
  }

  function draw() {
    ctx.clearRect(0, 0, W, H)
    drawPoolEdge()
    drawWater()

    for (const f of fishes) {
      if (!f.caught) drawFish(f, time)
    }

    drawLine()
    drawBiteMeter()

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // 前景猫爪（遮住画面底部）
    drawPaws()

    // HUD strip
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(0, 0, W, 26)
    ctx.fillStyle = '#f0f4f8'
    ctx.font = '12px system-ui,sans-serif'
    ctx.textAlign = 'left'
    const luckyTxt = lucky > 0 ? `　闪光 ${lucky}` : ''
    ctx.fillText(
      `积分 ${score}　渔获 ${catches}　饵 ${bait}${luckyTxt}　图鉴 ${encFound()}/${FISH_KINDS.length}`,
      10,
      17,
    )

    if (phase === 'ready') {
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.font = '13px system-ui,sans-serif'
      ctx.textAlign = 'center'
      ctx.globalAlpha = 0.55 + 0.35 * Math.abs(Math.sin(time * 2))
      ctx.fillText('点击水面抛竿', W * 0.5, H * 0.42)
      ctx.globalAlpha = 1
    }

    if (phase === 'catch' && lastCatch) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(W / 2 - 110, H * 0.32 - 28, 220, 56)
      ctx.strokeStyle = '#f0c040'
      ctx.strokeRect(W / 2 - 110, H * 0.32 - 28, 220, 56)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 14px system-ui,sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('钓到了！', W / 2, H * 0.32 - 6)
      ctx.font = '12px system-ui,sans-serif'
      ctx.fillStyle = '#f0c040'
      ctx.fillText(lastCatch, W / 2, H * 0.32 + 14)
    }
  }

  function loop(now: number) {
    if (!running) return
    const dt = Math.min(0.05, (now - t0) / 1000)
    t0 = now
    update(dt)
    draw()
    raf = requestAnimationFrame(loop)
  }

  function onPointer(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    const y = e.clientY - rect.top
    if (y < 8) return
    if (phase === 'ready' || phase === 'miss' || phase === 'catch') {
      if (y > waterY * 0.5 || phase === 'ready') cast()
    } else {
      tryReel()
    }
  }

  function start() {
    if (running) return
    running = true
    resize()
    resetHook()
    spawnFish()
    emitHud()
    t0 = performance.now()
    canvas.addEventListener('pointerdown', onPointer)
    window.addEventListener('resize', resize)
    void Promise.all([loadImg(LOGO_ASSETS.fish), loadImg(LOGO_ASSETS.cat)])
      .then(([fish, cat]) => {
        imgs = { fish, cat }
      })
      .catch(() => {
        /* 素材失败时仍可玩，爪/派派鱼暂不显示 */
      })
    raf = requestAnimationFrame(loop)
  }

  function stop() {
    running = false
    cancelAnimationFrame(raf)
    canvas.removeEventListener('pointerdown', onPointer)
    window.removeEventListener('resize', resize)
  }

  return { start, stop, cast, tryReel, buyShopItem, newGame, resize }
}

export type CanvasFishGame = ReturnType<typeof createCanvasFishGame>
