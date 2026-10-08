import { createFishpiApp } from './app'
import { useAppearanceStore } from './stores/appearance'
import { useAdsStore } from './stores/ads'
import { useAuthStore } from './stores/auth'
import { takeClientPayload } from './seo/payload'

takeClientPayload()

const { app, router } = createFishpiApp()

void router.isReady().then(() => {
  app.mount('#app', true)
  useAppearanceStore()
  void useAdsStore().load()
  void useAuthStore()
    .restore()
    .finally(() => {
      useAppearanceStore().enforceVip()
    })
})
