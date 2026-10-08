/** Exchange apiKey → page session cookie (via server) + csrfToken for Rhythm page POSTs. */

const SS_KEY = 'fp.pageAuth'
let memory: { apiKey: string; csrfToken: string; at: number } | null = null
const TTL_MS = 30 * 60 * 1000

function readSession(apiKey: string): string {
  if (typeof sessionStorage === 'undefined') return ''
  try {
    const raw = sessionStorage.getItem(SS_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { apiKey?: string; csrfToken?: string; at?: number }
    if (parsed.apiKey !== apiKey || !parsed.csrfToken) return ''
    if (Date.now() - Number(parsed.at || 0) > TTL_MS) return ''
    return parsed.csrfToken
  } catch {
    return ''
  }
}

function writeSession(apiKey: string, csrfToken: string) {
  memory = { apiKey, csrfToken, at: Date.now() }
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(memory))
  } catch {
    /* ignore */
  }
}

export async function ensureCsrfToken(apiKey: string): Promise<string> {
  if (!apiKey) throw new Error('需要登录')
  if (memory && memory.apiKey === apiKey && Date.now() - memory.at < TTL_MS && memory.csrfToken) {
    return memory.csrfToken
  }
  const fromSs = readSession(apiKey)
  if (fromSs) {
    memory = { apiKey, csrfToken: fromSs, at: Date.now() }
    return fromSs
  }

  const res = await fetch('/__fp/page-auth', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  })
  const text = await res.text()
  let data: { csrfToken?: string; msg?: string } = {}
  try {
    data = JSON.parse(text) as { csrfToken?: string; msg?: string }
  } catch {
    throw new Error('页面鉴权失败')
  }
  if (!res.ok || !data.csrfToken) {
    throw new Error(data.msg || '无法获取 CSRF，请重新登录后再试')
  }
  writeSession(apiKey, data.csrfToken)
  return data.csrfToken
}

export function clearPageAuthCache() {
  memory = null
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(SS_KEY)
    } catch {
      /* ignore */
    }
  }
}

/** 跳到 Rhythm 渲染的页面（游戏、里程碑、统计等）：先换好页面会话，失败也照常跳转，由现网决定是否要求登录。 */
export async function openRhythmPage(href: string, apiKey?: string | null) {
  if (apiKey) {
    try {
      await ensureCsrfToken(apiKey)
    } catch {
      /* 现网会自行跳登录 */
    }
  }
  window.location.href = href
}
