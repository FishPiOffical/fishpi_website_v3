import { installModeSync } from './api/mode'
import { createFishpiApp } from './app'
import { useAppearanceStore } from './stores/appearance'
import { useAdsStore } from './stores/ads'
import { useClientStartupStore } from './stores/clientStartup'
import { takeClientPayload } from './seo/payload'

const stopModeSync=installModeSync()
if(import.meta.hot) import.meta.hot.dispose(stopModeSync)
takeClientPayload()

const { app, router, pinia } = createFishpiApp()

void router.isReady().then(() => {
  app.mount('#app', true)
  useAppearanceStore()
  void useAdsStore().load()
  void useClientStartupStore(pinia).start(router)
})
