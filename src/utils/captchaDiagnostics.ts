type DiagnosticValue = string | number | boolean | null
type DiagnosticFields = Record<string, DiagnosticValue | undefined>
type DiagnosticEvent = Record<string, DiagnosticValue>

const PREFIX = '[FP captcha]'
const STORAGE_KEY = 'fp.captcha-diagnostics.v1'
const LIMIT = 600
const VERSION = '20261121.1'
const fields = new Set([
  'requestId', 'flowId', 'gateId', 'generation', 'widgetGeneration', 'submission', 'attempt',
  'path', 'method', 'origin', 'status', 'code', 'serverRequestId', 'responseType', 'redirected',
  'durationMs', 'authVersion', 'hasAccessToken', 'authorizationAttached', 'credentials',
  'captchaRevision', 'failureRevision', 'homeReadsActive', 'homeReadGeneration', 'homePaused',
  'reason', 'phase', 'ready', 'busy', 'open', 'aborted', 'hasProof', 'errorName',
  'browser', 'bundle', 'timezoneOffset', 'elapsedMs', 'online', 'visibility',
  'navigationType', 'serviceWorkerControlled', 'width', 'height', 'vendorCode',
])
const staticSegments = new Set(('api v3 auth login logout refresh session captcha-options registration-options registration password-reset request complete '
  + 'me users articles comments columns hot tags domains search recent-members breezemoons repeater items next '
  + 'statistics rankings cities pets pet profile settings membership styles professions medals image notifications '
  + 'chat realtime-ticket realtime tickets messages private-messages conversations unread count reaction reactions emojis '
  + 'paragraphs paragraph-comments location random following followers watching content page votes rewards '
  + 'validateCaptcha test risk challenge verify phone email verification authorize oauth token revoke').split(' '))
const events = new Set([
  'page.start', 'storage.unavailable', 'storage.invalid', 'export',
  'http.queued', 'http.start', 'http.dispatch', 'http.response', 'http.complete', 'http.error', 'auth.changed',
  'recovery.wait', 'recovery.start', 'recovery.join', 'recovery.success', 'recovery.failure', 'recovery.end',
  'challenge.received', 'challenge.late', 'request.retry', 'request.retry-result', 'request.invalidated',
  'opener.register', 'opener.open', 'opener.join', 'opener.missing', 'opener.success', 'opener.failure',
  'gate.mounted', 'gate.open', 'gate.mount', 'gate.ready', 'gate.error', 'gate.proof', 'gate.ignored',
  'gate.submit', 'gate.accepted', 'gate.rejected', 'gate.remount', 'gate.close', 'gate.unmounted',
  'proof.result', 'widget.mount', 'widget.script', 'widget.ready', 'widget.success', 'widget.stale',
  'widget.reset', 'widget.destroy', 'widget.error', 'widget.close', 'widget.fail', 'widget.vendor-ready',
])
let history: DiagnosticEvent[] = []
let initialized = false
let sequence = 0
let identifiers = 0
let storageAvailable = true
const pageId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)

export function captchaDiagnosticId(kind: 'request' | 'flow' | 'gate') {
  return `${kind}-${pageId}-${++identifiers}`
}

export function captchaDiagnosticPath(path: string) {
  try {
    return new URL(path, 'https://fishpi.cn').pathname.split('/').map(segment =>
      !segment || staticSegments.has(segment) ? segment : ':value').join('/')
  } catch {
    return ':invalid-path'
  }
}

export function captchaDiagnosticOrigin(path: string) {
  try {
    return new URL(path, window.location?.origin).origin
  } catch {
    return null
  }
}

export function captchaDiagnosticError(error: unknown): DiagnosticFields {
  const candidate = error as { status?: unknown; code?: unknown; name?: unknown } | null
  const code = candidate?.code
  return {
    status: typeof candidate?.status === 'number' ? candidate.status : 0,
    code: typeof code === 'string' && /^(?:captcha_required|captcha|aborted|stale_session|offline|invalid_response|home_reads_paused|unauthorized)$/.test(code)
      ? code : typeof code === 'number' ? code : 'other',
    errorName: error instanceof TypeError ? 'TypeError' : error instanceof Error ? 'Error' : 'unknown',
  }
}

function safeFields(input: DiagnosticFields): DiagnosticEvent {
  const output: DiagnosticEvent = {}
  for (const [key, value] of Object.entries(input)) {
    if (fields.has(key) && value !== undefined && (value === null || ['string', 'number', 'boolean'].includes(typeof value))) {
      output[key] = typeof value === 'string' ? value.slice(0, 160) : value
    }
  }
  return output
}

function persist() {
  if (!storageAvailable) return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {
    storageAvailable = false
    const entry = { event: 'storage.unavailable', time: new Date().toISOString(), pageId, sequence: ++sequence, version: VERSION }
    history.push(entry)
    if (history.length > LIMIT) history.splice(0, history.length - LIMIT)
    console.log(PREFIX, JSON.stringify(entry))
  }
}

function initialize() {
  if (initialized) return
  initialized = true
  try {
    const stored: unknown = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(stored)) throw new Error('invalid history')
    history = stored.slice(-LIMIT).filter(entry => entry && typeof entry === 'object' && events.has(entry.event)).map(entry => ({
      ...safeFields(entry), event: entry.event,
      time: typeof entry.time === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(entry.time) ? entry.time : '',
      pageId: typeof entry.pageId === 'string' && /^[a-z0-9-]{1,48}$/.test(entry.pageId) ? entry.pageId : '',
      sequence: typeof entry.sequence === 'number' ? entry.sequence : 0,
      version: typeof entry.version === 'string' && /^[0-9.]{1,24}$/.test(entry.version) ? entry.version : 'unknown',
    }))
  } catch {
    storageAvailable = false
    console.log(PREFIX, JSON.stringify({ event: 'storage.unavailable', version: VERSION, pageId }))
  }
  const target = window as Window & { fpCaptchaDiagnostics?: { export: () => string; clear: () => void } }
  target.fpCaptchaDiagnostics = {
    export: () => JSON.stringify({ version: VERSION, exportedAt: new Date().toISOString(), events: history }, null, 2),
    clear: () => { history = []; persist() },
  }
  const browser = globalThis.navigator?.userAgent?.match(/(?:Chrome|Firefox|Version|Edg)\/[\d.]+/)?.[0] || 'unknown'
  const moduleName = import.meta.url.split('/').pop()?.split('?')[0]
  const bundle = moduleName && /^[A-Za-z0-9_.-]+\.js$/.test(moduleName) ? moduleName : 'development'
  const entry: DiagnosticEvent = {
    event: 'page.start', time: new Date().toISOString(), pageId, sequence: ++sequence, version: VERSION,
    browser, bundle, timezoneOffset: new Date().getTimezoneOffset(),
    origin: captchaDiagnosticOrigin(window.location?.href || ''),
    path: captchaDiagnosticPath(window.location?.pathname || '/'),
    navigationType: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type || 'unknown',
    serviceWorkerControlled: Boolean(globalThis.navigator?.serviceWorker?.controller),
    width: window.innerWidth || 0, height: window.innerHeight || 0,
  }
  history.push(entry)
  console.log(PREFIX, JSON.stringify(entry))
}

export function captchaDiagnostic(event: string, input: DiagnosticFields = {}) {
  if (typeof window === 'undefined' || import.meta.env?.SSR || !events.has(event)) return
  initialize()
  const entry: DiagnosticEvent = {
    ...safeFields(input), event, time: new Date().toISOString(), elapsedMs: Math.round(performance.now()),
    pageId, sequence: ++sequence, version: VERSION,
    online: globalThis.navigator?.onLine ?? null,
    visibility: globalThis.document?.visibilityState || 'unknown',
  }
  history.push(entry)
  if (history.length > LIMIT) history.splice(0, history.length - LIMIT)
  persist()
  console.log(PREFIX, JSON.stringify(entry))
}
