import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAppearanceStore } from './stores/appearance'
import { useAdsStore } from './stores/ads'
import { useAuthStore } from './stores/auth'
import './styles/base.css'
import './packs'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

useAppearanceStore(pinia)
void useAdsStore(pinia).load()
void useAuthStore(pinia)
  .restore()
  .finally(() => {
    app.mount('#app')
  })
