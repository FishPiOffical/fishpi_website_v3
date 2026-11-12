import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'fishpi.pet.display.v1'

/** 仅记录本机桌宠的显示偏好，不保存账号或宠物养成数据。 */
export const usePetDisplayStore = defineStore('petDisplay', () => {
  const visible = ref(true)
  const collapsed = ref(false)
  const position = ref<{ x: number; y: number } | null>(null)
  let restored = false

  function persist() {
    if (import.meta.env.SSR) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ visible: visible.value, collapsed: collapsed.value, position: position.value }))
    } catch { /* 浏览器禁用存储时，本次显示设置仍然有效。 */ }
  }

  function restore() {
    if (restored || import.meta.env.SSR) return
    restored = true
    collapsed.value = window.matchMedia('(max-width: 640px)').matches
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const value = JSON.parse(raw)
      if (typeof value.visible === 'boolean') visible.value = value.visible
      if (typeof value.collapsed === 'boolean') collapsed.value = value.collapsed
      if (Number.isFinite(value.position?.x) && Number.isFinite(value.position?.y)) {
        position.value = { x: value.position.x, y: value.position.y }
      }
    } catch { /* 损坏的本机偏好不影响宠物家园和服务端数据。 */ }
  }

  function show() { visible.value = true; persist() }
  function hide() { visible.value = false; persist() }
  function setCollapsed(value: boolean) { collapsed.value = value; persist() }
  function move(x: number, y: number, save = false) {
    position.value = { x, y }
    if (save) persist()
  }
  function resetPosition() { position.value = null; visible.value = true; persist() }

  return { visible, collapsed, position, restore, show, hide, setCollapsed, move, resetPosition }
})
