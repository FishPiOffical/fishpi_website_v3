import { nextTick, onScopeDispose, ref, watch } from 'vue'
import type { HomeModuleId } from '@/home/modules'
import { useHomeLayoutStore, type HomeDropTarget } from '@/stores/homeLayout'

export type HomeDropEdge = 'top' | 'bottom' | 'left' | 'right'

export function useHomeDrag() {
  const layout = useHomeLayoutStore()
  const dragging = ref<HomeModuleId | null>(null)
  const target = ref<HomeDropTarget | null>(null)

  let scrollFrame = 0
  let lastFrame = 0
  let pointer: { x: number; y: number } | null = null

  function stopScroll() {
    if (scrollFrame) window.cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
    lastFrame = 0
    pointer = null
  }

  function selectModule(id: HomeModuleId, element: HTMLElement, x: number, y: number) {
    if (!dragging.value || id === dragging.value) { target.value = null; return }
    const r = element.getBoundingClientRect()
    const edge = Math.min(r.width * 0.25, 80)
    const canSide = layout.canAddCell(id, dragging.value)
    if (canSide && x - r.left < edge) target.value = { kind: 'side', anchor: id, after: false }
    else if (canSide && r.right - x < edge) target.value = { kind: 'side', anchor: id, after: true }
    else target.value = { kind: 'stack', anchor: id, after: y - r.top > r.height / 2 }
  }

  function scrollStep(time: number) {
    scrollFrame = 0
    if (!pointer || !dragging.value || !layout.editing) return
    const { x, y } = pointer
    const band = Math.min(120, window.innerHeight / 4)
    const speed = y < band ? -(1 - y / band) : y > window.innerHeight - band ? (y - window.innerHeight + band) / band : 0
    const elapsed = lastFrame ? Math.min(time - lastFrame, 32) : 16
    lastFrame = time
    if (speed) window.scrollBy({ top: Math.max(-1, Math.min(1, speed)) * 720 * elapsed / 1000, behavior: 'instant' })
    // 滚动后重新命中落点，鼠标停住时也不能沿用滚动前的模块位置。
    const hit = document.elementFromPoint(x, y)
    const card = hit?.closest<HTMLElement>('.home.editing [data-home-module]')
    const gap = hit?.closest<HTMLElement>('[data-home-row-gap]')
    if (card) selectModule(card.dataset.homeModule as HomeModuleId, card, x, y)
    else if (gap) target.value = { kind: 'row', anchor: (gap.dataset.homeRowGap || null) as HomeModuleId | null }
    else target.value = null
    scrollFrame = window.requestAnimationFrame(scrollStep)
  }

  function trackPointer(e: DragEvent) {
    if (!dragging.value) return
    if (e.clientX < 0 || e.clientX >= window.innerWidth || e.clientY < 0 || e.clientY >= window.innerHeight) { stopScroll(); return }
    pointer = { x: e.clientX, y: e.clientY }
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(scrollStep)
  }

  function leaveWindow(e: DragEvent) {
    if (!e.relatedTarget) { stopScroll(); target.value = null }
  }

  function onDragStart(e: DragEvent, id: HomeModuleId) {
    if (!layout.editing) {
      e.preventDefault()
      return
    }
    onDragEnd()
    dragging.value = id
    document.addEventListener('dragover', trackPointer, true)
    document.addEventListener('dragleave', leaveWindow)
    window.addEventListener('drop', onDragEnd)
    window.addEventListener('dragend', onDragEnd)
    window.addEventListener('blur', onDragEnd)
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
      const card = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-home-module]')
      if (card) e.dataTransfer.setDragImage(card, 24, 22)
    }
  }

  function onDragEnd() {
    if (typeof window !== 'undefined') {
      stopScroll()
      document.removeEventListener('dragover', trackPointer, true)
      document.removeEventListener('dragleave', leaveWindow)
      window.removeEventListener('drop', onDragEnd)
      window.removeEventListener('dragend', onDragEnd)
      window.removeEventListener('blur', onDragEnd)
    }
    dragging.value = null
    target.value = null
  }

  function onModuleOver(e: DragEvent, id: HomeModuleId) {
    if (!dragging.value) return
    e.preventDefault()
    e.stopPropagation()
    selectModule(id, e.currentTarget as HTMLElement, e.clientX, e.clientY)
  }

  function onGapOver(e: DragEvent, anchor: HomeModuleId | null) {
    if (!dragging.value) return
    e.preventDefault()
    target.value = { kind: 'row', anchor }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (layout.editing && dragging.value && target.value) layout.moveTo(dragging.value, target.value)
    onDragEnd()
  }

  function dropLabel(id: HomeModuleId) {
    return { top: '插入上方', bottom: '插入下方', left: '左侧新建一列', right: '右侧新建一列' }[edgeOf(id) || 'top']
  }

  async function onHandleKeydown(e: KeyboardEvent, id: HomeModuleId) {
    if (e.key === 'Escape') { onDragEnd(); return }
    if (!layout.editing || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
    e.preventDefault()
    const ids = layout.visibleRows.flatMap(row => row.cells.flatMap(cell => cell.modules.map(mod => mod.id)))
    const index = ids.indexOf(id)
    const after = e.key === 'ArrowDown' || e.key === 'ArrowRight'
    const anchor = ids[index + (after ? 1 : -1)]
    if (!anchor) return
    const side = e.key === 'ArrowLeft' || e.key === 'ArrowRight'
    if (side && !layout.canAddCell(anchor, id)) return
    layout.moveTo(id, side ? { kind: 'side', anchor, after } : { kind: 'stack', anchor, after })
    // 跨列移动会重建节点，恢复手柄焦点以便连续调整。
    await nextTick()
    document.querySelector<HTMLElement>(`[data-home-module="${id}"] .mod-drag-bar`)?.focus()
  }

  watch(() => layout.editing, value => { if (!value) onDragEnd() }, { flush: 'sync' })
  onScopeDispose(onDragEnd)

  function edgeOf(id: HomeModuleId): HomeDropEdge | null {
    const t = target.value
    if (!t || t.kind === 'row' || t.anchor !== id) return null
    if (t.kind === 'side') return t.after ? 'right' : 'left'
    return t.after ? 'bottom' : 'top'
  }

  function gapActive(anchor: HomeModuleId | null) {
    const t = target.value
    return Boolean(t && t.kind === 'row' && t.anchor === anchor)
  }

  return { dragging, onDragStart, onDragEnd, onModuleOver, onGapOver, onDrop, edgeOf, gapActive, dropLabel, onHandleKeydown }
}
