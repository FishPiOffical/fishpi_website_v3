const START_INTERVAL_MS = 500
const MAX_IN_FLIGHT = 2
const INITIAL_COOLDOWN_MS = 30_000
const MAX_BACKOFF_MS = 300_000

function retryAfterMs(value: string | undefined, now: number) {
  if (!value) return 0
  return /^\d+$/.test(value) ? Number(value) * 1000 : Math.max(0, Date.parse(value) - now) || 0
}

export function createSsrUpstreamGate() {
  let nextStart = 0
  let inFlight = 0
  let retryAt = 0
  let backoff = INITIAL_COOLDOWN_MS
  let transportFailures = 0
  let probing = false
  let generation = 0

  return async function run<T>(load: () => Promise<T>): Promise<T> {
    const now = Date.now()
    if (now < retryAt || probing || now < nextStart || inFlight >= MAX_IN_FLIGHT || (retryAt && inFlight)) {
      throw Object.assign(new Error('SSR 上游请求暂缓'), { code: 'ssr_deferred' })
    }
    const probe = retryAt !== 0
    if (probe) probing = true
    const startedIn = generation
    nextStart = now + START_INTERVAL_MS
    inFlight++
    try {
      const result = await load()
      if (startedIn === generation) {
        transportFailures = 0
        if (probe) {
          retryAt = 0
          backoff = INITIAL_COOLDOWN_MS
        }
      }
      return result
    } catch (error) {
      const failure = error as { status?: number; code?: string; retryAfter?: string }
      const rateLimited = failure?.status === 429 || failure?.code === 'captcha'
      const transportFailed = failure?.code === 'offline' || failure?.code === 'ssr_timeout'
      const failedAt = Date.now()
      const retryAfter = retryAfterMs(failure?.retryAfter, failedAt)
      if (startedIn === generation && (rateLimited || (transportFailed && ++transportFailures >= 2) || probe)) {
        retryAt = failedAt + Math.max(backoff, retryAfter)
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
        generation++
      } else if (rateLimited && retryAfter) {
        retryAt = Math.max(retryAt, failedAt + retryAfter)
      } else if (startedIn === generation && !transportFailed) {
        transportFailures = 0
      }
      throw error
    } finally {
      inFlight--
      if (probe) probing = false
    }
  }
}
