import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import { ApiError, getAccessToken, onAccessTokenChange, refreshAccessToken, wasRefreshRejected, request, setAccessToken } from '@/api/http'
import { clearCache } from '@/utils/swr'
import { login as loginApi, type AccountInfo, type V3AccountInfo } from '@/api/fishpi'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  // Kept only for modules awaiting migration; never put a Bearer token in this field.
  const apiKey = ref<string | null>(null)
  const account = ref<AccountInfo | null>(null)
  const isVip = ref(false)
  const loading = ref(false)
  const error = ref('')
  const initialized = ref(false)
  let version = 0
  let restoreFlight: Promise<void> | null = null
  let loginFlight: Promise<void> | null = null

  const isLoggedIn = computed(() => Boolean(accessToken.value && account.value))
  const unsubscribe = onAccessTokenChange((token) => {
    if (accessToken.value !== token) clearCache()
    accessToken.value = token
    if (!token) {
      account.value = null
      isVip.value = false
    }
  })
  onScopeDispose(unsubscribe)

  function toAccount(data: V3AccountInfo): AccountInfo {
    return { ...data, oId: data.id }
  }

  function assertCurrent(expected: number) {
    if (expected !== version) throw new ApiError('登录状态已变更', 401, 'stale_session')
  }

  async function loadAccount(expected: number) {
    const res = await request<{ code: number; msg?: string; data?: V3AccountInfo }>('/api/v3/me')
    assertCurrent(expected)
    if (res.code !== 0 || !res.data) throw new ApiError(res.msg || '登录状态已失效', 401)
    account.value = toAccount(res.data)
    await refreshMembership()
    assertCurrent(expected)
  }

  function restore(): Promise<void> {
    if (import.meta.env.SSR) return Promise.resolve()
    if (loginFlight) return loginFlight
    if (restoreFlight) return restoreFlight
    if (initialized.value && (isLoggedIn.value || !accessToken.value)) return Promise.resolve()
    const expected = version
    const operation = (async () => {
      try {
        if (!getAccessToken() && !await refreshAccessToken()) {
          // Definitive absence is cached; transient failures may be retried on a later navigation.
          initialized.value = wasRefreshRejected()
          return
        }
        assertCurrent(expected)
        await loadAccount(expected)
        initialized.value = true
      } catch (e) {
        if (expected === version && e instanceof ApiError && e.status === 401) {
          setAccessToken(null)
          initialized.value = true
        }
      }
    })().finally(() => {
      if (restoreFlight === operation) restoreFlight = null
    })
    restoreFlight = operation
    return operation
  }

  async function refreshMembership() {
    const expected = version
    const id = account.value?.oId
    if (!id) {
      isVip.value = false
      return
    }
    try {
      const m = await request<{ code: number; data?: { active?: boolean } }>('/api/v3/me/membership')
      if (m.code !== 0 || typeof m.data?.active !== 'boolean') throw new ApiError('会员状态响应无效', 502)
      if (expected === version && account.value?.oId === id) isVip.value = m.data.active
    } catch {
      if (expected === version && account.value?.oId === id) isVip.value = false
    }
  }

  function login(username: string, passwd: string, mfaCode = ''): Promise<void> {
    const expected = ++version
    setAccessToken(null)
    initialized.value = false
    loading.value = true
    error.value = ''
    const operation = (async () => {
      try {
        const token = await loginApi(username, passwd, mfaCode)
        assertCurrent(expected)
        // Publish synchronously before /me, rather than relying on Vue's deferred watch queue.
        setAccessToken(token)
        await loadAccount(expected)
        initialized.value = true
      } catch (e) {
        if (expected === version) {
          setAccessToken(null)
          error.value = e instanceof Error ? e.message : '登录失败'
        }
        throw e
      } finally {
        if (expected === version) loading.value = false
      }
    })().finally(() => {
      if (loginFlight === operation) loginFlight = null
    })
    loginFlight = operation
    return operation
  }

  async function logout() {
    ++version
    setAccessToken(null)
    apiKey.value = null
    initialized.value = true
    loading.value = false
    error.value = ''
    // The transport serializes this cookie mutation after any pending rotation/login.
    await request('/api/v3/auth/logout', { method: 'POST' }).catch(() => {})
  }

  async function reloadAccount() {
    if (!accessToken.value) return
    await loadAccount(version)
  }

  return { accessToken, apiKey, account, isVip, loading, error, initialized, isLoggedIn,
    restore, login, logout, refreshMembership, reloadAccount }
})
