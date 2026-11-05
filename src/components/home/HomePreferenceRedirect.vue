<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getApiMode } from '@/api/mode'
import { getAuthContextVersion } from '@/api/http'
import { fetchV3Preferences } from '@/api/v3-preferences'
import { SITE_ORIGIN } from '@/seo/site'
import { homeRedirectBases, homeRedirectDestination } from '@/utils/homeRedirect'

const auth = useAuthStore(), route = useRoute(), router = useRouter()
const pending = ref(false), message = ref('')
let mounted = false, generation = 0
const identity = () => JSON.stringify([getAuthContextVersion(), getApiMode()==='v1'?auth.apiKey:!!auth.accessToken, auth.account?.oId || ''])
const eligible = () => mounted && auth.initialized && auth.isLoggedIn && route.path === '/' && !Object.keys(route.query).length && !route.hash
async function check() {
  const run = ++generation, reader = identity(), entry = route.fullPath
  pending.value = false; message.value = ''
  if (!eligible()) return
  const current = () => eligible() && run === generation && identity() === reader && route.fullPath === entry
  pending.value = true
  let navigating = false
  try {
    const settings = await fetchV3Preferences('functions')
    if (!current()) return
    const target = homeRedirectDestination(String(settings.indexRedirectURL), router,
      homeRedirectBases(SITE_ORIGIN, getApiMode()==='v1' ? import.meta.env.VITE_API_V1_TARGET || 'https://fishpi.cn' : import.meta.env.VITE_API_V3_TARGET || import.meta.env.VITE_API_TARGET, window.location.origin))
    if (target.kind === 'unsupported') message.value = '首页跳转目标暂不支持，已保留首页。'
    else if (target.kind === 'target') {
      navigating = true
      const failure = await router.replace(target.path)
      if (failure && current()) message.value = '首页跳转未完成，已保留首页。'
    }
  } catch {
    if (current()) message.value = navigating ? '首页跳转未完成，已保留首页。' : '首页跳转设置读取失败，已保留首页。'
  } finally { if (run === generation) pending.value = false }
}
watch(() => JSON.stringify([auth.initialized, identity(), route.fullPath]), () => { if (mounted) void check() }, { flush: 'sync' })
onMounted(() => { mounted = true; void check() })
onBeforeUnmount(() => { mounted = false; generation++; pending.value = false; message.value = '' })
</script>
<template>
  <div v-if="pending || message" class="home-redirect" role="status" aria-label="首页跳转设置">
    <span v-if="pending">正在读取首页跳转设置…</span>
    <template v-else>{{ message }} <button type="button" @click="check">重试跳转</button> <RouterLink to="/settings/function">修改首页设置</RouterLink></template>
  </div>
</template>
<style scoped lang="scss">
.home-redirect { margin: 0 0 12px; overflow-wrap: anywhere; color: var(--fp-text-muted); a { display: inline-block; white-space: nowrap; } button { margin: 0 8px; border: 1px solid var(--fp-border); border-radius: 6px; padding: 4px 8px; background: transparent; color: var(--fp-text); cursor: pointer; } }
</style>
