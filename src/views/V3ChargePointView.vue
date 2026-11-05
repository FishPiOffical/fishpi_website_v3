<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { fetchV3DonationPage } from '@/api/v3-donation'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'
usePageSeo(() => ({ title: '捐助摸鱼派', path: '/charge/point', robots: 'noindex' }))
const route = useRoute(), auth = useAuthStore(), { accessToken, account } = storeToRefs(auth)
const mounted = ref(false), busy = ref(false), error = ref(''), url = ref('')
let sequence = 0, owner = ''
function identity() { return accessToken.value ? `${getAuthContextVersion()}:${account.value?.oId || ''}` : '' }
function clear() { sequence++; url.value = error.value = ''; busy.value = false }
async function load() {
  if (busy.value || !mounted.value || !identity()) return
  const current = ++sequence, bound = identity(); busy.value = true; error.value = ''; url.value = ''
  try {
    const result = await fetchV3DonationPage()
    if (mounted.value && current === sequence && identity() === bound) {
      if (typeof window !== 'undefined' && result === new URL('/charge/point', window.location.origin).href) throw new Error('捐助地址指向当前页面，请联系站点管理员检查页面地址配置')
      url.value = result
    }
  } catch (err) { if (mounted.value && current === sequence && identity() === bound) error.value = err instanceof Error ? err.message : '读取捐助页面失败' }
  finally { if (mounted.value && current === sequence && identity() === bound) busy.value = false }
}
watch([accessToken, () => account.value?.oId], () => { const next = identity(); if (owner === next) return; owner = next; clear(); if (next) void load() }, { flush: 'sync' })
onMounted(() => { mounted.value = true; owner = identity(); void load() })
onBeforeUnmount(() => { mounted.value = false; clear() })
</script>
<template>
  <section class="donation-page">
    <h1>❤️ 捐助摸鱼派</h1>
    <p>捐助用于社区运营。请打开站内捐助页面，按该页面提示继续操作。</p>
    <p class="hint">浏览器未登录经典站点时，需要先在该页面登录。</p>
    <p v-if="!mounted">正在准备捐助入口…</p>
    <p v-else-if="!accessToken"><RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录后读取捐助入口</RouterLink></p>
    <template v-else>
      <p v-if="busy" role="status">正在读取捐助入口…</p>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <template v-if="url"><a class="donation-link" :href="url" target="_blank" rel="noopener noreferrer">打开站内捐助页面</a><p class="address">{{ url }}</p></template>
      <button type="button" :disabled="busy" @click="load">重新读取捐助入口</button>
    </template>
    <nav aria-label="相关积分功能"><RouterLink to="/vips">开通 VIP</RouterLink><RouterLink to="/settings/point">积分转账</RouterLink><RouterLink to="/points">积分流水</RouterLink></nav>
  </section>
</template>
<style scoped lang="scss">
.donation-page { max-width: 560px; margin: 24px auto; padding: 22px 24px; display: grid; gap: 16px; } h1 { margin: 0; font-size: 20px; color: var(--fp-title); } p { margin: 0; line-height: 1.6; color: var(--fp-text); } .hint { color: var(--fp-muted); } .address { overflow-wrap: anywhere; font-size: 13px; } .error { color: #c34a36; } button { justify-self: start; padding: 8px 12px; background: transparent; color: var(--fp-text); border: 1px solid var(--fp-border); border-radius: 8px; cursor: pointer; } button:disabled { opacity: .5; cursor: default; } a { color: var(--fp-link); } nav { display: flex; flex-wrap: wrap; gap: 14px; }
</style>
