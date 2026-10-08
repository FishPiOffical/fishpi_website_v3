#!/usr/bin/env node
/**
 * Print / refresh cached apiKey for local scripts.
 * Prefer existing FP_API_KEY or .fp-cache/api-key; password login only as last resort.
 *
 *   node scripts/dev-auth.mjs           # validate cache, print status
 *   FP_USER=x FP_PASS=y node scripts/dev-auth.mjs --login  # only if cache invalid
 */
import { getDevApiKey, readCachedApiKey, validateApiKey, writeCachedApiKey } from './lib/devKey.mjs'

const wantLogin = process.argv.includes('--login')

const cached = readCachedApiKey()
if (cached) {
  const account = await validateApiKey(cached)
  if (account) {
    writeCachedApiKey(cached)
    console.log(
      JSON.stringify({
        ok: true,
        source: process.env.FP_API_KEY ? 'env' : 'cache',
        userName: account.userName,
        keyLen: cached.length,
        reused: true,
      }),
    )
    process.exit(0)
  }
  console.error('cached apiKey invalid, need refresh')
}

if (!wantLogin && !process.env.FP_USER) {
  console.error(
    JSON.stringify({
      ok: false,
      msg: '无有效缓存。请将 apiKey 写入 .fp-cache/api-key 或设置 FP_API_KEY；需要密码登录时再加 --login 与 FP_USER/FP_PASS。',
    }),
  )
  process.exit(1)
}

try {
  const r = await getDevApiKey({ allowPasswordLogin: wantLogin || Boolean(process.env.FP_USER) })
  console.log(
    JSON.stringify({
      ok: true,
      source: r.source,
      userName: r.account.userName,
      keyLen: r.apiKey.length,
      reused: r.source !== 'password',
    }),
  )
} catch (e) {
  console.error(JSON.stringify({ ok: false, msg: e instanceof Error ? e.message : String(e) }))
  process.exit(1)
}
