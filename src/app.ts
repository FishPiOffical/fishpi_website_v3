import { createSSRApp, type App } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import { createHead as createClientHead } from '@unhead/vue/client'
import { createHead as createServerHead } from '@unhead/vue/server'
import AppRoot from './App.vue'
import { createAppRouter } from './router'
import type { Router } from 'vue-router'
import './styles/base.css'
import './packs'

export interface FishpiAppContext {
  app: App
  router: Router
  pinia: Pinia
  head: ReturnType<typeof createClientHead> | ReturnType<typeof createServerHead>
}

export function createFishpiApp(): FishpiAppContext {
  const app = createSSRApp(AppRoot)
  const pinia = createPinia()
  const head = import.meta.env.SSR ? createServerHead() : createClientHead()
  const router = createAppRouter()

  app.use(pinia)
  app.use(router)
  app.use(head)

  return { app, router, pinia, head }
}
