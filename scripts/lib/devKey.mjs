/**
 * Dev/script helper: reuse a cached apiKey. Never call /api/getKey unless
 * the cache is missing/invalid and FP_USER + FP_PASS are provided.
 *
 * Sources (first hit wins after validation):
 * 1. process.env.FP_API_KEY
 * 2. .fp-cache/api-key (gitignored)
 * 3. Optional password login via FP_USER / FP_PASS → then write cache
 */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cacheDir = path.join(root, '.fp-cache')
const cacheFile = path.join(cacheDir, 'api-key')
const UA =
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'

function apiTarget() {
  return (process.env.VITE_API_TARGET || process.env.FP_API_TARGET || 'https://fishpi.cn').replace(/\/$/, '')
}

export function readCachedApiKey() {
  const fromEnv = (process.env.FP_API_KEY || '').trim()
  if (fromEnv) return fromEnv
  try {
    if (fs.existsSync(cacheFile)) {
      const key = fs.readFileSync(cacheFile, 'utf-8').trim()
      if (key) return key
    }
  } catch {
    /* ignore */
  }
  return ''
}

export function writeCachedApiKey(apiKey) {
  const key = String(apiKey || '').trim()
  if (!key) return
  fs.mkdirSync(cacheDir, { recursive: true })
  fs.writeFileSync(cacheFile, `${key}\n`, { mode: 0o600 })
  try {
    fs.chmodSync(cacheFile, 0o600)
  } catch {
    /* ignore */
  }
}

export async function validateApiKey(apiKey) {
  if (!apiKey) return null
  const res = await fetch(`${apiTarget()}/api/user?apiKey=${encodeURIComponent(apiKey)}`, {
    headers: { 'User-Agent': UA, Referer: `${apiTarget()}/` },
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  if (json.code !== 0 || !json.data) return null
  return json.data
}

async function loginWithPassword(user, pass) {
  const userPassword = createHash('md5').update(String(pass), 'utf8').digest('hex')
  const res = await fetch(`${apiTarget()}/api/getKey`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      Referer: `${apiTarget()}/login`,
    },
    body: JSON.stringify({ nameOrEmail: user, userPassword }),
  })
  const json = await res.json()
  if (json.code !== 0 || !json.Key) {
    throw new Error(json.msg || '登录失败（请优先使用已缓存的 FP_API_KEY / .fp-cache/api-key）')
  }
  return json.Key
}

/**
 * @returns {Promise<{ apiKey: string, account: object, source: string }>}
 */
export async function getDevApiKey({ allowPasswordLogin = true } = {}) {
  const cached = readCachedApiKey()
  if (cached) {
    const account = await validateApiKey(cached)
    if (account) {
      writeCachedApiKey(cached)
      return {
        apiKey: cached,
        account,
        source: process.env.FP_API_KEY ? 'env' : 'cache',
      }
    }
  }

  if (!allowPasswordLogin) {
    throw new Error('无有效 apiKey。请设置 FP_API_KEY 或写入 .fp-cache/api-key，勿反复调用 /api/getKey。')
  }

  const user = (process.env.FP_USER || '').trim()
  const pass = process.env.FP_PASS || ''
  if (!user || !pass) {
    throw new Error(
      '缓存 apiKey 无效或缺失，且未设置 FP_USER/FP_PASS。请把有效 apiKey 写入 .fp-cache/api-key 或 FP_API_KEY，避免触发登录限频。',
    )
  }

  const apiKey = await loginWithPassword(user, pass)
  writeCachedApiKey(apiKey)
  const account = await validateApiKey(apiKey)
  if (!account) throw new Error('登录成功但 /api/user 校验失败')
  return { apiKey, account, source: 'password' }
}
