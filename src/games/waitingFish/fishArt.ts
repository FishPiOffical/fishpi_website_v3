/** 按鱼种名字/id 生成不同造型，避免一律画成标准鱼 */

import type { FishKind } from './fishKinds'

export type FishForm =
  | 'fish'
  | 'loach'
  | 'eel'
  | 'shrimp'
  | 'jelly'
  | 'ray'
  | 'crab'
  | 'dragon'
  | 'angler'
  | 'salamander'
  | 'whale'
  | 'toad'
  | 'koi'
  | 'drop'
  | 'phoenix'
  | 'serpent'

const RULES: Array<{ form: FishForm; re: RegExp }> = [
  { form: 'drop', re: /第一滴水|first_drop|滴水/ },
  { form: 'phoenix', re: /凰|phoenix/ },
  { form: 'jelly', re: /水母|jelly/ },
  { form: 'shrimp', re: /虾|shrimp/ },
  { form: 'crab', re: /蟹|hermit|urn_hermit/ },
  { form: 'ray', re: /鳐|ray|stormray/ },
  { form: 'loach', re: /泥鳅|loach/ },
  { form: 'eel', re: /鳗|eel/ },
  { form: 'dragon', re: /晶龙|洞天|leviathan|root_dragon|气根龙/ },
  { form: 'serpent', re: /蛟|serpent|wyrm|龙(?!鱼)/ },
  { form: 'angler', re: /鮟鱇|angler/ },
  { form: 'salamander', re: /蝾螈|salamander/ },
  { form: 'whale', re: /鲸|whale/ },
  { form: 'toad', re: /蟾|toad/ },
  { form: 'koi', re: /锦鲤|koi|月鳞鲤|熔岩鲤|clockwork/ },
]

export function fishFormOf(kind: Pick<FishKind, 'id' | 'name'>): FishForm {
  const key = `${kind.id} ${kind.name}`
  for (const r of RULES) {
    if (r.re.test(key)) return r.form
  }
  return 'fish'
}

type DrawOpts = {
  scale?: number
  /** 1 朝右，-1 朝左（与素材约定一致：本地坐标头朝 +x） */
  face?: number
  t?: number
  phase?: number
  locked?: boolean
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.arc(x + r * 0.25, y, r * 0.45, 0, Math.PI * 2)
  ctx.fill()
}

/** 在当前变换下绘制（原点为身体中心，头朝 +x） */
export function drawFishForm(
  ctx: CanvasRenderingContext2D,
  kind: FishKind,
  opts: DrawOpts = {},
) {
  const scale = opts.scale ?? 1
  const face = opts.face ?? 1
  const t = opts.t ?? 0
  const phase = opts.phase ?? 0
  const locked = !!opts.locked
  const form = fishFormOf(kind)
  const color = locked ? '#3a4550' : kind.color
  const belly = locked ? '#2a323a' : kind.belly
  const fin = locked ? '#2a323a' : kind.fin
  const wag = Math.sin(t * 8 + phase) * 0.35

  ctx.save()
  ctx.scale(face * scale, scale)
  ctx.rotate(wag * 0.12)

  switch (form) {
    case 'loach':
      drawLoach(ctx, color, belly, fin, wag)
      break
    case 'eel':
      drawEel(ctx, color, belly, fin, wag)
      break
    case 'shrimp':
      drawShrimp(ctx, color, belly, fin, wag)
      break
    case 'jelly':
      drawJelly(ctx, color, belly, fin, t, phase)
      break
    case 'ray':
      drawRay(ctx, color, belly, fin, wag)
      break
    case 'crab':
      drawCrab(ctx, color, belly, fin, wag)
      break
    case 'dragon':
    case 'serpent':
      drawDragon(ctx, color, belly, fin, wag, form === 'dragon')
      break
    case 'angler':
      drawAngler(ctx, color, belly, fin, wag, t)
      break
    case 'salamander':
      drawSalamander(ctx, color, belly, fin, wag)
      break
    case 'whale':
      drawWhale(ctx, color, belly, fin, wag)
      break
    case 'toad':
      drawToad(ctx, color, belly, fin, wag)
      break
    case 'koi':
      drawKoi(ctx, color, belly, fin, wag)
      break
    case 'drop':
      drawDrop(ctx, color, belly, fin, t)
      break
    case 'phoenix':
      drawPhoenix(ctx, color, belly, fin, wag)
      break
    default:
      drawStandardFish(ctx, color, belly, fin, wag)
  }

  if (locked && form !== 'drop') {
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.beginPath()
    ctx.arc(0, 0, 18, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawStandardFish(
  ctx: CanvasRenderingContext2D,
  color: string,
  belly: string,
  fin: string,
  wag: number,
) {
  const s = 14
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(0, 0, s, s * 0.55, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = belly
  ctx.globalAlpha = 0.55
  ctx.beginPath()
  ctx.ellipse(s * 0.1, s * 0.18, s * 0.7, s * 0.28, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = fin
  ctx.beginPath()
  ctx.moveTo(-s * 0.85, 0)
  ctx.lineTo(-s * 1.45, -s * 0.55 + wag * 6)
  ctx.lineTo(-s * 1.45, s * 0.55 - wag * 6)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-s * 0.1, -s * 0.5)
  ctx.quadraticCurveTo(s * 0.15, -s * 1.05, s * 0.45, -s * 0.35)
  ctx.fill()
  eye(ctx, s * 0.45, -s * 0.08, s * 0.16)
}

/** 泥鳅：细长圆柱 + 小须 */
function drawLoach(
  ctx: CanvasRenderingContext2D,
  color: string,
  belly: string,
  fin: string,
  wag: number,
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(0, 0, 20, 5.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = belly
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.ellipse(2, 1.8, 14, 2.4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  // 斑点
  ctx.fillStyle = fin
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.ellipse(-10 + i * 5, -1.2 + (i % 2) * 1.5, 1.6, 1.1, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // 尾
  ctx.beginPath()
  ctx.moveTo(-18, 0)
  ctx.quadraticCurveTo(-24, -4 + wag * 3, -26, 0)
  ctx.quadraticCurveTo(-24, 4 - wag * 3, -18, 0)
  ctx.fill()
  // 须
  ctx.strokeStyle = fin
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(14, 1)
  ctx.quadraticCurveTo(20, 4, 22, 7)
  ctx.moveTo(14, -1)
  ctx.quadraticCurveTo(20, -3, 22, -5)
  ctx.stroke()
  eye(ctx, 12, -1.2, 1.6)
}

function drawEel(
  ctx: CanvasRenderingContext2D,
  color: string,
  belly: string,
  fin: string,
  wag: number,
) {
  ctx.strokeStyle = color
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-22, wag * 2)
  ctx.bezierCurveTo(-8, -6 - wag * 2, 6, 6 + wag * 2, 18, -wag)
  ctx.stroke()
  ctx.strokeStyle = belly
  ctx.lineWidth = 3
  ctx.globalAlpha = 0.55
  ctx.beginPath()
  ctx.moveTo(-20, wag * 2 + 1)
  ctx.bezierCurveTo(-8, -4 - wag * 2, 6, 5 + wag * 2, 16, -wag + 1)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.fillStyle = fin
  ctx.beginPath()
  ctx.moveTo(-22, wag * 2)
  ctx.lineTo(-28, -4 + wag * 4)
  ctx.lineTo(-28, 4 - wag * 4)
  ctx.fill()
  eye(ctx, 16, -1.5, 1.8)
}

function drawShrimp(
  ctx: CanvasRenderingContext2D,
  color: string,
  belly: string,
  fin: string,
  wag: number,
) {
  // 身节
  ctx.fillStyle = color
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.ellipse(-8 + i * 5, Math.sin(i + wag) * 1.2, 4.2, 3.2, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = belly
  ctx.beginPath()
  ctx.ellipse(10, 0, 5, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  // 尾扇
  ctx.fillStyle = fin
  ctx.beginPath()
  ctx.moveTo(-14, 0)
  ctx.lineTo(-22, -6 + wag * 2)
  ctx.lineTo(-20, 0)
  ctx.lineTo(-22, 6 - wag * 2)
  ctx.closePath()
  ctx.fill()
  // 触须
  ctx.strokeStyle = fin
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(14, -1)
  ctx.quadraticCurveTo(22, -8, 26, -10)
  ctx.moveTo(14, 1)
  ctx.quadraticCurveTo(22, 6, 26, 8)
  ctx.stroke()
  eye(ctx, 12, -2, 1.5)
}

function drawJelly(
  ctx: CanvasRenderingContext2D,
  color: string,
  belly: string,
  fin: string,
  t: number,
  phase: number,
) {
  ctx.fillStyle = color
  ctx.globalAlpha = 0.85
  ctx.beginPath()
  ctx.ellipse(0, -2, 12, 9, 0, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = belly
  ctx.globalAlpha = 0.45
  ctx.beginPath()
  ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 0.7
  ctx.strokeStyle = fin
  ctx.lineWidth = 1.4
  for (let i = 0; i < 5; i++) {
    const x = -8 + i * 4
    const sway = Math.sin(t * 3 + phase + i) * 3
    ctx.beginPath()
    ctx.moveTo(x, 4)
    ctx.quadraticCurveTo(x + sway, 12, x - sway * 0.5, 18)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  eye(ctx, 4, -4, 1.8)
}

function drawRay(
  ctx: CanvasRenderingContext2D,
  color: string,
  belly: string,
  fin: string,
  wag: number,
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(14, 0)
  ctx.quadraticCurveTo(0, -14 - wag, -16, 0)
  ctx.quadraticCurveTo(0, 14 + wag, 14, 0)
  ctx.fill()
  ctx.fillStyle = belly
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = fin
  ctx.beginPath()
  ctx.moveTo(-14, 0)
  ctx.lineTo(-22, -3)
  ctx.lineTo(-20, 0)
  ctx.lineTo(-22, 3)
  ctx.fill()
  eye(ctx, 6, -2, 1.6)
}

function drawCrab(
  ctx: CanvasRenderingContext2D,
  color: string,
  belly: string,
  fin: string,
  wag: number,
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = belly
  ctx.beginPath()
  ctx.ellipse(0, 2, 7, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = fin
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  // 螯
  ctx.beginPath()
  ctx.moveTo(8, -4)
  ctx.quadraticCurveTo(16, -10 - wag, 18, -4)
  ctx.moveTo(8, 4)
  ctx.quadraticCurveTo(16, 10 + wag, 18, 4)
  ctx.stroke()
  // 腿
  for (let i = 0; i < 3; i++) {
    const y = -4 + i * 4
    ctx.beginPath()
    ctx.moveTo(-6, y)
    ctx.lineTo(-14, y - 3 + wag)
    ctx.stroke()
  }
  eye(ctx, 4, -3, 1.7)
  eye(ctx, 4, 3, 1.7)
}

function drawDragon(
  ctx: CanvasRenderingContext2D,
  color: string,
  belly: string,
  fin: string,
  wag: number,
  horns: boolean,
) {
  ctx.strokeStyle = color
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-20, wag * 3)
  ctx.bezierCurveTo(-6, -10, 4, 10, 16, -wag * 2)
  ctx.stroke()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(14, -wag, 7, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = belly
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.ellipse(14, 1, 5, 2.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = fin
  // 背鳍
  for (let i = 0; i < 4; i++) {
    const x = -12 + i * 6
    ctx.beginPath()
    ctx.moveTo(x, -2)
    ctx.lineTo(x + 2, -10 - (i % 2))
    ctx.lineTo(x + 4, -2)
    ctx.fill()
  }
  if (horns) {
    ctx.beginPath()
    ctx.moveTo(16, -4)
    ctx.lineTo(20, -12)
    ctx.lineTo(18, -3)
    ctx.fill()
  }
  eye(ctx, 16, -2, 1.8)
}

function drawAngler(
  ctx: CanvasRenderingContext2D,
  color: string,
  belly: string,
  fin: string,
  wag: number,
  t: number,
) {
  drawStandardFish(ctx, color, belly, fin, wag)
  ctx.strokeStyle = fin
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(8, -8)
  ctx.quadraticCurveTo(14, -18, 10, -22)
  ctx.stroke()
  const glow = 0.5 + 0.5 * Math.abs(Math.sin(t * 4))
  ctx.fillStyle = `rgba(255,230,120,${0.4 + glow * 0.5})`
  ctx.beginPath()
  ctx.arc(10, -22, 3 + glow, 0, Math.PI * 2)
  ctx.fill()
}

function drawSalamander(
  ctx: CanvasRenderingContext2D,
  color: string,
  belly: string,
  fin: string,
  wag: number,
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = belly
  ctx.beginPath()
  ctx.ellipse(2, 1.5, 10, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = fin
  // 四肢
  const legs = [
    [6, 4],
    [6, -4],
    [-6, 4],
    [-6, -4],
  ] as const
  for (const [x, y] of legs) {
    ctx.beginPath()
    ctx.ellipse(x, y + wag, 3, 1.6, y > 0 ? 0.4 : -0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.moveTo(-14, 0)
  ctx.quadraticCurveTo(-22, wag * 4, -26, 0)
  ctx.quadraticCurveTo(-22, -wag * 4, -14, 0)
  ctx.fill()
  eye(ctx, 10, -1.5, 1.7)
}

function drawWhale(
  ctx: CanvasRenderingContext2D,
  color: string,
  belly: string,
  fin: string,
  wag: number,
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = belly
  ctx.globalAlpha = 0.55
  ctx.beginPath()
  ctx.ellipse(2, 3, 14, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = fin
  ctx.beginPath()
  ctx.moveTo(-18, 0)
  ctx.lineTo(-28, -8 + wag * 3)
  ctx.lineTo(-26, 0)
  ctx.lineTo(-28, 8 - wag * 3)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(0, -8)
  ctx.lineTo(4, -16)
  ctx.lineTo(8, -7)
  ctx.fill()
  eye(ctx, 12, -2, 2)
}

function drawToad(
  ctx: CanvasRenderingContext2D,
  color: string,
  belly: string,
  fin: string,
  wag: number,
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(0, 0, 12, 11, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = belly
  ctx.beginPath()
  ctx.ellipse(0, 3, 8, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = fin
  ctx.beginPath()
  ctx.ellipse(-10, 6 + wag, 4, 2, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(6, 7 + wag, 4, 2, -0.3, 0, Math.PI * 2)
  ctx.fill()
  eye(ctx, 4, -5, 2.4)
  eye(ctx, -2, -5, 2.4)
}

function drawKoi(
  ctx: CanvasRenderingContext2D,
  color: string,
  belly: string,
  fin: string,
  wag: number,
) {
  drawStandardFish(ctx, color, belly, fin, wag)
  // 斑块
  ctx.fillStyle = fin
  ctx.globalAlpha = 0.65
  ctx.beginPath()
  ctx.ellipse(2, -2, 4, 3, 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-4, 2, 3.5, 2.5, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  // 长尾
  ctx.fillStyle = belly
  ctx.beginPath()
  ctx.moveTo(-12, 0)
  ctx.quadraticCurveTo(-20, -10 + wag * 4, -24, -2)
  ctx.lineTo(-18, 0)
  ctx.quadraticCurveTo(-20, 10 - wag * 4, -24, 2)
  ctx.closePath()
  ctx.fill()
}

function drawDrop(
  ctx: CanvasRenderingContext2D,
  color: string,
  belly: string,
  _fin: string,
  t: number,
) {
  const pulse = 1 + Math.sin(t * 2) * 0.06
  ctx.save()
  ctx.scale(pulse, pulse)
  ctx.fillStyle = color
  ctx.globalAlpha = 0.85
  ctx.beginPath()
  ctx.moveTo(0, -14)
  ctx.bezierCurveTo(10, -4, 10, 10, 0, 14)
  ctx.bezierCurveTo(-10, 10, -10, -4, 0, -14)
  ctx.fill()
  ctx.fillStyle = belly
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.ellipse(-2, -2, 3, 4, -0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
}

function drawPhoenix(
  ctx: CanvasRenderingContext2D,
  color: string,
  belly: string,
  fin: string,
  wag: number,
) {
  drawStandardFish(ctx, color, belly, fin, wag)
  ctx.fillStyle = fin
  ctx.globalAlpha = 0.8
  // 翼状鳍
  ctx.beginPath()
  ctx.moveTo(0, -4)
  ctx.quadraticCurveTo(8, -16 - wag * 2, 18, -10)
  ctx.quadraticCurveTo(8, -8, 2, -2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(0, 4)
  ctx.quadraticCurveTo(8, 16 + wag * 2, 18, 10)
  ctx.quadraticCurveTo(8, 8, 2, 2)
  ctx.fill()
  ctx.globalAlpha = 1
}
