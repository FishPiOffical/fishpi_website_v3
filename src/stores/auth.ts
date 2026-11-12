import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import { ApiError, getAccessToken, onAccessTokenChange, refreshAccessToken, wasRefreshRejected, request, setAccessToken, withHomeSessionPriority } from '@/api/http'
import { clearCache } from '@/utils/swr'
import { login as loginApi, type AccountInfo, type V3AccountInfo } from '@/api/fishpi'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const account = ref<AccountInfo | null>(null)
  const isVip = ref(false)
  const membershipPending = ref(false)
  const membershipChecked = ref(false)
  const loading = ref(false)
  const error = ref('')
  const initialized = ref(false)
  const logoutPending = ref(false)
  let sessionFlight: Promise<void> | null = null
  let sessionRevision: string | null = null
  let lastSessionCheck = 0
  let sessionTimer: ReturnType<typeof setTimeout> | null = null
  let version = 0
  let restoreFlight: Promise<void> | null = null
  let loginFlight: Promise<void> | null = null
  let membershipRun = 0

  const isLoggedIn = computed(() => Boolean(accessToken.value && account.value))
  const unsubscribe = onAccessTokenChange((token) => {
    if (accessToken.value !== token) clearCache()
    accessToken.value = token
    if (!token) {
      membershipRun++
      membershipPending.value = false
      membershipChecked.value = false
      account.value = null
      isVip.value = false
    }
  })
  onScopeDispose(() => {
    unsubscribe()
    if (sessionTimer !== null) clearTimeout(sessionTimer)
  })

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
  }

  function restore(): Promise<void> {
    if (import.meta.env.SSR) return Promise.resolve()
    if (logoutPending.value) return Promise.resolve()
    if (loginFlight) return loginFlight
    if (restoreFlight) return restoreFlight
    if (initialized.value && (isLoggedIn.value || !accessToken.value)) return Promise.resolve()
    const expected = version
    const operation = withHomeSessionPriority(async () => {
      try {
        if (!getAccessToken() && !await refreshAccessToken()) {
          // Definitive absence is cached; transient failures may be retried on a later navigation.
          if (expected === version) initialized.value = wasRefreshRejected()
          return
        }
        assertCurrent(expected)
        await loadAccount(expected)
        assertCurrent(expected)
        void refreshMembership()
        initialized.value = true
      } catch (e) {
        if (expected === version && e instanceof ApiError && e.status === 401) {
          setAccessToken(null)
          initialized.value = true
        }
      }
    }).finally(() => {
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
    const run = ++membershipRun
    const current = () => run === membershipRun && expected === version && account.value?.oId === id
    membershipPending.value = true
    try {
      const m = await request<{ code: number; data?: { active?: boolean } }>('/api/v3/me/membership')
      if (m.code !== 0 || typeof m.data?.active !== 'boolean') throw new ApiError('会员状态响应无效', 502)
      if (current()) {
        isVip.value = m.data.active
        membershipChecked.value = true
      }
    } catch {
      // A failed background read doesn't determine entitlement.
    } finally {
      if (current()) membershipPending.value = false
    }
  }

  function login(username: string, passwd: string, mfaCode = ''): Promise<void> {
    const expected = ++version
    logoutPending.value = false
    sessionRevision = null
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
        assertCurrent(expected)
        void refreshMembership()
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
    const expected = ++version
    logoutPending.value = true
    sessionRevision = null
    setAccessToken(null)
    initialized.value = true
    loading.value = false
    error.value = ''
    // 本地立即清身份，但服务端撤销失败必须保留重试入口，不能静默宣称退出成功。
    try {
      await request('/api/v3/auth/logout', { method: 'POST' })
      if (expected === version) logoutPending.value = false
    } catch (e) {
      if (expected === version) error.value = '退出暂未完成，请重试'
    }
  }

  function syncWebsiteSession(): Promise<void> {
    if (import.meta.env.SSR || !initialized.value || logoutPending.value || loginFlight || restoreFlight) return Promise.resolve()
    if (sessionFlight) return sessionFlight
    const remaining = 5000 - (Date.now() - lastSessionCheck)
    if (remaining > 0) {
      // 节流保留最后一次触发，避免用户快速切页退出后丢失同步。
      if (sessionTimer === null) sessionTimer = setTimeout(() => {
        sessionTimer = null
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') void syncWebsiteSession()
      }, remaining)
      return Promise.resolve()
    }
    if (sessionTimer !== null) { clearTimeout(sessionTimer); sessionTimer = null }
    lastSessionCheck = Date.now()
    const expected = version
    const operation = (async () => {
      try {
        const res = await request<{ code: number; data?: { userId: string | null; revision: string | null; linked?: boolean } }>(
          '/api/v3/auth/session', { method: 'POST' })
        if (expected !== version || logoutPending.value || res.code !== 0 || !res.data) return
        if (res.data.linked === false) return
        const { userId, revision } = res.data
        if (userId !== null && typeof userId !== 'string' || revision !== null && typeof revision !== 'string') return
        const changed = userId !== (account.value?.oId ?? null)
          || sessionRevision !== null && revision !== sessionRevision
        sessionRevision = revision
        if (!changed) return
        ++version
        setAccessToken(null)
        initialized.value = !userId
        // 只恢复服务器刚确认的绑定会话；不会凭旧版 Cookie 自动签发新令牌。
        if (userId) await restore()
      } catch {
        // 网络故障不等于退出；下一次切回页面再核对，不循环请求。
      }
    })().finally(() => { if (sessionFlight === operation) sessionFlight = null })
    sessionFlight = operation
    return operation
  }

  async function reloadAccount() {
    if (!accessToken.value) return
    await loadAccount(version)
    void refreshMembership()
  }

  return { accessToken, account, isVip, membershipPending, membershipChecked, loading, error, initialized, isLoggedIn,
    restore, login, logout, logoutPending, syncWebsiteSession, refreshMembership, reloadAccount }
})
