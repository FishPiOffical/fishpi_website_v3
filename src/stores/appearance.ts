import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import {
  DEFAULT_BUBBLE,
  DEFAULT_FRAME,
  DEFAULT_THEME,
  findPack,
  type PackKind,
  type PackMeta,
} from '@/packs'
import { useAuthStore } from './auth'

const STORAGE = 'fp.appearance'

interface AppearanceState {
  theme: string
  bubble: string
  frame: string
}

function read(): AppearanceState {
  if (import.meta.env.SSR || typeof localStorage === 'undefined') {
    return { theme: DEFAULT_THEME, bubble: DEFAULT_BUBBLE, frame: DEFAULT_FRAME }
  }
  try {
    const raw = localStorage.getItem(STORAGE)
    if (raw) return { theme: DEFAULT_THEME, bubble: DEFAULT_BUBBLE, frame: DEFAULT_FRAME, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { theme: DEFAULT_THEME, bubble: DEFAULT_BUBBLE, frame: DEFAULT_FRAME }
}

function applyDom(state: AppearanceState) {
  if (import.meta.env.SSR || typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = state.theme
  root.dataset.bubble = state.bubble
  root.dataset.frame = state.frame
}

export const useAppearanceStore = defineStore('appearance', () => {
  const state = ref(read())
  const notice = ref('')

  applyDom(state.value)

  watch(
    state,
    (v) => {
      applyDom(v)
      if (!import.meta.env.SSR && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE, JSON.stringify(v))
      }
    },
    { deep: true },
  )

  function canUse(pack: PackMeta) {
    if (pack.kind === 'theme' || !pack.vip) return true
    return useAuthStore().isVip
  }

  function apply(kind: PackKind, id: string) {
    const pack = findPack(kind, id)
    if (!pack) return
    notice.value = ''
    if (!canUse(pack)) {
      notice.value = '对话框和头像框的进阶样式将作为 VIP 功能开放，开通后即可使用。'
      return
    }
    if (kind === 'theme') state.value.theme = id
    if (kind === 'bubble') state.value.bubble = id
    if (kind === 'frame') state.value.frame = id
  }

  function toggleTheme() {
    apply('theme', state.value.theme === 'classic-dark' ? 'classic-light' : 'classic-dark')
  }

  function enforceVip() {
    const auth = useAuthStore()
    if (auth.isVip) return
    const bubble = findPack('bubble', state.value.bubble)
    const frame = findPack('frame', state.value.frame)
    if (bubble?.vip) state.value.bubble = DEFAULT_BUBBLE
    if (frame?.vip) state.value.frame = DEFAULT_FRAME
  }

  return { state, notice, canUse, apply, toggleTheme, enforceVip }
})
