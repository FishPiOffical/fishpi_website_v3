/** Exchange apiKey → page session cookie (via server) + csrfToken for Rhythm page POSTs. */

let cache: { apiKey: string; csrfToken: string; at: number } | null = null
const TTL_MS = 30 * 60 * 1000

export async function ensureCsrfToken(apiKey: string): Promise<string> {
  if (!apiKey) throw new Error('需要登录')
  if (cache && cache.apiKey === apiKey && Date.now() - cache.at < TTL_MS && cache.csrfToken) {
    return cache.csrfToken
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
  cache = { apiKey, csrfToken: data.csrfToken, at: Date.now() }
  return data.csrfToken
}

export function clearPageAuthCache() {
  cache = null
}
