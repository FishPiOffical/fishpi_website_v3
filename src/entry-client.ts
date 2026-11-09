import { watch } from 'vue'
import { setHomeReadsActive } from './api/http'
import { createFishpiApp } from './app'
import { useAppearanceStore } from './stores/appearance'
import { useAdsStore } from './stores/ads'
import { useClientStartupStore } from './stores/clientStartup'
import { useHomeLayoutStore } from './stores/homeLayout'
import { takeClientPayload } from './seo/payload'

takeClientPayload()

const { app, router, pinia } = createFishpiApp()

void router.isReady().then(() => {
  watch(() => router.currentRoute.value.name === 'home', setHomeReadsActive, { immediate: true, flush: 'sync' })
  app.mount('#app', true)
  useHomeLayoutStore(pinia).restore()
  useAppearanceStore()
  void useAdsStore().load()
  window.addEventListener('fp:retry-public', () => {
    if (router.currentRoute.value.name === 'home') void useClientStartupStore(pinia).start(router)
  })
  void useClientStartupStore(pinia).start(router)
})
