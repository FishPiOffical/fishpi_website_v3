import { watch } from 'vue'
import { request, setHomeReadsActive } from './api/http'
import { createFishpiApp } from './app'
import { useAppearanceStore } from './stores/appearance'
import { useAdsStore } from './stores/ads'
import { useClientStartupStore } from './stores/clientStartup'
import { useHomeLayoutStore } from './stores/homeLayout'
import { takeClientPayload } from './seo/payload'

const initialPayload = takeClientPayload()

const { app, router, pinia } = createFishpiApp()

void router.isReady().then(() => {
  watch(() => router.currentRoute.value.name === 'home', setHomeReadsActive, { immediate: true, flush: 'sync' })
  app.mount('#app', true)
  if (initialPayload.upstreamCaptcha === true) {
    // 浏览器用自己的来源核实，不因 SSR 服务器受限直接要求用户验证。
    void request('/api/v3/auth/captcha-options').then(() => {
      window.dispatchEvent(new Event('fp:retry-public'))
    }).catch(error => console.warn('[SSR recovery]', error instanceof Error ? error.message : '验证恢复失败'))
  }
  useHomeLayoutStore(pinia).restore()
  useAppearanceStore()
  void useAdsStore().load()
  window.addEventListener('fp:retry-public', () => {
    if (router.currentRoute.value.name === 'home') void useClientStartupStore(pinia).start(router)
  })
  void useClientStartupStore(pinia).start(router)
})
