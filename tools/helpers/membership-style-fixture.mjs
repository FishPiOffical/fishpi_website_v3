import fs from 'node:fs/promises'
import ts from 'typescript'
export const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
export const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
export async function fixture() {
  const original = { now: Date.now, setTimeout, clearTimeout }, timers = new Map()
  let now = 100_000, timerId = 0
  Date.now = () => now
  globalThis.setTimeout = (fn, delay = 0) => { const id = ++timerId; timers.set(id, { at: now + delay, fn }); return id }
  globalThis.clearTimeout = id => timers.delete(id)
  const state = globalThis.__snapshotStyle = { token: null, listeners: [], hot: { dispose(fn) { state.dispose = fn } }, ssr: false, calls: [], lookups: [], requests: [], version: 'a'.repeat(64), rows: [{ userId: '1', configJson: '{"bold":true,"color":"rainbow"}' }], maxAgeMs: 30_000 }
  state.lookup = async name => ({ id: '1', userName: name })
  state.dispatch = async version => ({ code: 0, data: version === state.version ? { version: state.version, unchanged: true, maxAgeMs: state.maxAgeMs } : { version: state.version, unchanged: false, maxAgeMs: state.maxAgeMs, list: state.rows } })
  state.request = async path => {
    state.requests.push(path)
    if (path.startsWith('/api/v3/users/')) { const name = decodeURIComponent(path.split('/').at(-1)); state.lookups.push(name); return { code: 0, data: await state.lookup(name) } }
    const version = new URL(path, 'http://localhost').searchParams.get('version') || undefined
    state.calls.push(version)
    return state.dispatch(version)
  }
  const http = url(`export class ApiError extends Error{constructor(message,status=0,code){super(message);this.status=status;this.code=code}} export const request=path=>globalThis.__snapshotStyle.request(path);export const getAccessToken=()=>globalThis.__snapshotStyle.token;export function onAccessTokenChange(fn){globalThis.__snapshotStyle.listeners.push(fn);fn(globalThis.__snapshotStyle.token);return()=>{globalThis.__snapshotStyle.listeners=globalThis.__snapshotStyle.listeners.filter(x=>x!==fn)}}`)
  const apiURL = url(compile(await fs.readFile('src/api/v3-membership-styles.ts', 'utf8')).replace("from './http'", `from '${http}'`))
  let source = compile(await fs.readFile('src/composables/useVipNickname.ts', 'utf8')).replaceAll('import.meta.env.SSR', 'globalThis.__snapshotStyle.ssr').replaceAll('import.meta.hot', 'globalThis.__snapshotStyle.hot')
  for (const [from, to] of [['vue', import.meta.resolve('vue')], ['@/api/http', http], ['@/api/v3-membership-styles', apiURL]]) source = source.replaceAll(`from '${from}'`, `from '${to}'`)
  const helperURL = url(source), helper = await import(helperURL), api = await import(apiURL)
  const tick = async () => { for (let i = 0; i < 60; i++) await Promise.resolve() }
  const token = value => { state.token = value; for (const fn of [...state.listeners]) fn(value) }
  async function advance(ms) {
    const target = now + ms
    for (let round = 0; round < 100; round++) {
      await tick()
      const next = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) { now = target; await tick(); return }
      now = next[1].at; timers.delete(next[0]); next[1].fn()
    }
    throw Error('Unbounded snapshot timer loop')
  }
  return { state, helper, helperURL, api, tick, token, advance, timers, cleanup() { state.dispose?.(); token(null); Date.now = original.now; globalThis.setTimeout = original.setTimeout; globalThis.clearTimeout = original.clearTimeout; delete globalThis.__snapshotStyle } }
}
