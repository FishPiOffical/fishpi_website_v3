/** Only anonymous public DTOs belong here; never cache an app, HTML or private state. */
export function createPublicHomeCache(ttlMs = 300_000, capacity = 16) {
  const values = new Map<string, { expires: number; value: unknown }>()
  const pending = new Map<string, Promise<unknown>>()
  return async function read<T>(key: string, load: () => Promise<T>, serveStale = false): Promise<T> {
    const cached = values.get(key)
    if (cached && cached.expires > Date.now()) return structuredClone(cached.value) as T
    const stale = serveStale ? cached : undefined
    let task = pending.get(key)
    if (!task) {
      task = Promise.resolve().then(load).then(value => {
        if (!values.has(key) && values.size >= capacity) values.delete(values.keys().next().value!)
        values.set(key, { expires: Date.now() + ttlMs, value: structuredClone(value) })
        return value
      }).catch(error => {
        if (([401, 403, 404, 410].includes(error?.status) || ['unauthorized', 'forbidden', 'not_found', 'gone'].includes(error?.code)) && values.get(key) === cached) values.delete(key)
        throw error
      }).finally(() => { pending.delete(key) })
      pending.set(key, task)
    }
    if (stale) {
      void task.catch(() => {})
      return structuredClone(stale.value) as T
    }
    return structuredClone(await task) as T
  }
}
