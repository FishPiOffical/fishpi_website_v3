import { nextTick, onScopeDispose, ref, watch } from 'vue'
import type { HomeModuleId } from '@/home/modules'
import { useHomeLayoutStore, type HomeDropTarget } from '@/stores/homeLayout'

export type HomeDropEdge = 'top' | 'bottom' | 'left' | 'right'

export function useHomeDrag() {
  const layout = useHomeLayoutStore()
  const dragging = ref<HomeModuleId | null>(null)
  const target = ref<HomeDropTarget | null>(null)

  function onDragStart(e: DragEvent, id: HomeModuleId) {
    if (!layout.editing) {
      e.preventDefault()
      return
    }
    dragging.value = id
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
      const card = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-home-module]')
      if (card) e.dataTransfer.setDragImage(card, 24, 22)
    }
  }

  function onDragEnd() {
    dragging.value = null
    target.value = null
  }

  function onModuleOver(e: DragEvent, id: HomeModuleId) {
    if (!dragging.value) return
    e.preventDefault()
    e.stopPropagation()
    if (id === dragging.value) {
      target.value = null
      return
    }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const edge = Math.min(r.width * 0.25, 80)
    const canSide = layout.canAddCell(id, dragging.value)
    if (canSide && e.clientX - r.left < edge) target.value = { kind: 'side', anchor: id, after: false }
    else if (canSide && r.right - e.clientX < edge) target.value = { kind: 'side', anchor: id, after: true }
    else target.value = { kind: 'stack', anchor: id, after: e.clientY - r.top > r.height / 2 }
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

  watch(() => layout.editing, value => { if (!value) onDragEnd() })
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
