import { defineStore } from 'pinia'
import { ref } from 'vue'

export type SettingsSection = 'home' | 'chatSidebar' | 'chatBlock' | 'income'

export const useSettingsDrawerStore = defineStore('settingsDrawer', () => {
  const open = ref(false)
  const section = ref<SettingsSection>('home')

  function show(s?: SettingsSection) {
    if (s) section.value = s
    open.value = true
  }

  function hide() {
    open.value = false
  }

  return { open, section, show, hide }
})
