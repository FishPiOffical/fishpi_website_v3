export interface FloatingPoint { x: number; y: number }
export interface FloatingSize { width: number; height: number }
export interface FloatingRect { left: number; top: number; right: number; bottom: number }

/** 仅计算本次摆放，不改写用户保存的位置；临时遮挡消失后可回到原位。 */
export function clampFloatingPoint(point: FloatingPoint, size: FloatingSize, bounds: FloatingRect): FloatingPoint {
  return {
    x: Math.max(bounds.left, Math.min(point.x, bounds.right - size.width)),
    y: Math.max(bounds.top, Math.min(point.y, bounds.bottom - size.height)),
  }
}

export function overlapsFloatingRect(a: FloatingRect, b: FloatingRect, gap = 0): boolean {
  return a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap
}

/** 在障碍边缘构造有限候选，选离原位最近的空位；无空间时明确返回空。 */
export function placeFloating(point: FloatingPoint, size: FloatingSize, bounds: FloatingRect, obstacles: FloatingRect[], gap = 8): FloatingPoint | null {
  if (bounds.right - bounds.left < size.width || bounds.bottom - bounds.top < size.height) return null
  const target = clampFloatingPoint(point, size, bounds)
  const relevant = obstacles.filter(rect => overlapsFloatingRect(rect, bounds)).slice(0, 24)
  const xs = new Set([target.x, bounds.left, bounds.right - size.width])
  const ys = new Set([target.y, bounds.top, bounds.bottom - size.height])
  for (const rect of relevant) {
    xs.add(clampFloatingPoint({ x: rect.left - size.width - gap, y: target.y }, size, bounds).x)
    xs.add(clampFloatingPoint({ x: rect.right + gap, y: target.y }, size, bounds).x)
    ys.add(clampFloatingPoint({ x: target.x, y: rect.top - size.height - gap }, size, bounds).y)
    ys.add(clampFloatingPoint({ x: target.x, y: rect.bottom + gap }, size, bounds).y)
  }
  let best: FloatingPoint | null = null, distance = Infinity
  for (const x of xs) for (const y of ys) {
    const rect = { left: x, top: y, right: x + size.width, bottom: y + size.height }
    if (relevant.some(obstacle => overlapsFloatingRect(rect, obstacle, gap))) continue
    const nextDistance = (x - target.x) ** 2 + (y - target.y) ** 2
    if (nextDistance < distance) { best = { x, y }; distance = nextDistance }
  }
  return best
}
