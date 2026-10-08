import type { Ref } from 'vue'

/**
 * 页面级 stale-while-revalidate 缓存：切换页面 / tab 时先展示上次的数据，同时后台拉新。
 * 仅存在于浏览器内存；SSR 下不读不写，避免跨请求串数据。
 */
const MAX_ENTRIES = 120
const store = new Map<string, unknown>()

export function readCache<T>(key: string): T | undefined {
  if (import.meta.env.SSR) return undefined
  return store.get(key) as T | undefined
}

export function writeCache<T>(key: string, data: T) {
  if (import.meta.env.SSR) return
  store.delete(key)
  store.set(key, data)
  if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string)
}

export function clearCache() {
  store.clear()
}

interface LoadState {
  loading: Ref<boolean>
  error?: Ref<string>
}

/**
 * 返回一个加载函数：命中缓存立即 apply 且不进入 loading，然后请求接口覆盖。
 * 只有最后一次调用的结果会生效，快速切换 tab 时旧请求自动作废。
 */
export function createSwrLoader(state: LoadState) {
  let seq = 0
  return async function load<T>(
    key: string,
    fetcher: () => Promise<T>,
    apply: (data: T, fromCache: boolean) => void,
    errorText = '加载失败',
  ): Promise<T | undefined> {
    const id = ++seq
    const hit = readCache<T>(key)
    if (state.error) state.error.value = ''
    if (hit !== undefined) {
      apply(hit, true)
      state.loading.value = false
    } else {
      state.loading.value = true
    }
    try {
      const data = await fetcher()
      if (id !== seq) return undefined
      writeCache(key, data)
      apply(data, false)
      return data
    } catch (e) {
      if (id === seq && hit === undefined && state.error) {
        state.error.value = e instanceof Error ? e.message : errorText
      }
      return undefined
    } finally {
      if (id === seq) state.loading.value = false
    }
  }
}
