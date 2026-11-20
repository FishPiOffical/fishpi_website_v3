<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { fetchLoginDevices, revokeLoginDevice, type LoginDevice } from '@/api/v3-login-devices'
import { fpConfirm } from '@/composables/useDialog'
import { formatDateTime, timeISO } from '@/utils/time'

const auth = useAuthStore()
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const devices = ref<LoginDevice[] | null>(null)
const busy = ref(false)
const feedback = ref('')
const error = ref('')
let identity: AbortController | undefined

async function read() {
  const signal = identity?.signal
  if (!signal || signal.aborted || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const rows = await fetchLoginDevices(signal)
    if (!signal.aborted) devices.value = rows
  } catch (cause) {
    if (!signal.aborted) {
      devices.value = null
      error.value = cause instanceof Error ? cause.message : '登录设备暂时无法读取'
    }
  } finally {
    if (!signal.aborted) busy.value = false
  }
}

async function remove(device: LoginDevice) {
  const signal = identity?.signal
  if (!signal || signal.aborted || busy.value || device.current || !devices.value?.includes(device)) return
  busy.value = true
  let refresh = false
  try {
    const yes = await fpConfirm({
      title: '退出设备', message: `让「${device.label}」退出登录？这台设备上已登录的新旧站网页都需要重新登录。`,
      confirmText: '退出该设备', tone: 'danger', signal,
    })
    if (!yes || signal.aborted) return
    error.value = feedback.value = ''
    await revokeLoginDevice(device.id, signal)
    if (!signal.aborted) {
      feedback.value = `「${device.label}」已退出登录。`
      refresh = true
    }
  } catch (cause) {
    if (signal.aborted) return
    if (cause instanceof ApiError && cause.status === 409) {
      feedback.value = '设备登录状态已变化，已重新查询。'
      refresh = true
    } else {
      devices.value = null
      error.value = cause instanceof ApiError && cause.status >= 400 && cause.status < 500
        ? cause.message : '退出结果尚未确认，请刷新设备列表核对。'
    }
  } finally {
    if (!signal.aborted) {
      busy.value = false
      if (refresh) await read()
    }
  }
}

watch(() => [mounted.value, !!auth.accessToken, auth.account?.oId, getAuthContextVersion()].join('|'), (_, __, cleanup) => {
  const controller = new AbortController()
  identity = controller
  cleanup(() => controller.abort())
  devices.value = null
  busy.value = false
  feedback.value = error.value = ''
  if (mounted.value && auth.accessToken && auth.account?.oId) void read()
}, { immediate: true, flush: 'sync' })
</script>

<template>
  <section id="login-devices" class="login-devices" aria-label="登录设备">
    <header class="settings-section-head">
      <h3>已登录的网页设备</h3>
      <button class="fp-control settings-refresh" type="button" :disabled="busy" aria-label="刷新登录设备" @click="read">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg>
      </button>
    </header>
    <p v-if="feedback" role="status">{{ feedback }}</p>
    <p v-if="error" role="alert" class="device-error">{{ error }}</p>
    <p v-else-if="devices === null && busy" role="status">正在读取登录设备…</p>
    <p v-else-if="devices?.length === 0">暂无可管理的网页登录设备。</p>
    <ul v-if="devices?.length">
      <li v-for="device in devices" :key="device.id">
        <div class="device-info">
          <strong>{{ device.label }}</strong>
          <span>最近活动 <time :datetime="timeISO(device.lastActiveAt)">{{ formatDateTime(device.lastActiveAt) }}</time></span>
        </div>
        <span v-if="device.current" class="current-device">当前设备</span>
        <button v-else class="fp-control" type="button" :aria-label="`退出 ${device.label}`"
          :disabled="busy" @click="remove(device)">退出登录</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.login-devices header, .login-devices li { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.login-devices h3, .login-devices ul { margin: 0; padding: 0; }
.login-devices ul { list-style: none; }
.login-devices li { padding: 12px 0; border-top: 1px solid var(--fp-divider); }
.login-devices header { margin-bottom: 10px; }
.login-devices button { flex-shrink: 0; }
.device-info { min-width: 0; display: grid; gap: 3px; overflow-wrap: anywhere; }
.device-info span, .login-devices p { color: var(--fp-muted); font-size: 13px; }
.current-device { flex-shrink: 0; padding: 2px 8px; border-radius: 5px; background: var(--fp-primary-soft); color: var(--fp-primary-ink); font-size: 12px; }
.login-devices .device-error { color: var(--fp-danger); }
</style>
