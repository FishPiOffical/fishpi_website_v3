import { createFishpiApp } from './app'
import { useAppearanceStore } from './stores/appearance'
import { useAdsStore } from './stores/ads'
import { useClientStartupStore } from './stores/clientStartup'
import { useHomeLayoutStore } from './stores/homeLayout'
import { takeClientPayload } from './seo/payload'

takeClientPayload()

const { app, router, pinia } = createFishpiApp()

void router.isReady().then(() => {
  app.mount('#app', true)
  useHomeLayoutStore(pinia).restore()
  useAppearanceStore()
  void useAdsStore().load()
  void useClientStartupStore(pinia).start(router)
})
