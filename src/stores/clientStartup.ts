import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Router } from 'vue-router'
import { useAuthStore } from './auth'
import { useAppearanceStore } from './appearance'

/** Hydrate the public server tree before restoring this application's browser identity. */
export const useClientStartupStore = defineStore('client-startup', () => {
  const ready = ref(false)
  const pending = ref(false)
  const error = ref('')
  let flight: Promise<void> | null = null
  let navigation = 0

  function navigationStarted() {
    navigation++
  }

  function start(router: Router): Promise<void> {
    if (import.meta.env.SSR || ready.value) return Promise.resolve()
    if (flight) return flight

    const revision = navigation
    const route = router.currentRoute.value
    const auth = useAuthStore()
    pending.value = true
    error.value = ''

    const operation = (async () => {
      try {
        await auth.restore()
        if (!auth.initialized && !auth.isLoggedIn) {
          throw new Error('登录状态暂时无法恢复，请重试。')
        }
        useAppearanceStore().enforceVip()
        // A pending SPA navigation owns its guard; do not replace a newer navigation.
        if (revision === navigation && router.currentRoute.value === route) {
          if (route.meta.auth && !auth.isLoggedIn) {
            await router.replace({ path: '/login', query: { redirect: route.fullPath } })
          } else if (route.name === 'login' && auth.isLoggedIn) {
            await router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/')
          }
        }
        ready.value = true
      } catch (reason) {
        error.value = reason instanceof Error ? reason.message : '登录状态恢复失败，请重试。'
      } finally {
        pending.value = false
      }
    })().finally(() => {
      if (flight === operation) flight = null
    })
    flight = operation
    return operation
  }

  return { ready, pending, error, start, navigationStarted }
})
