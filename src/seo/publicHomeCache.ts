/** Only anonymous public DTOs belong here; never cache an app, HTML or private state. */
export function createPublicHomeCache(ttlMs = 300_000, capacity = 16) {
  type Entry = { expires: number; value: unknown }
  const values = new Map<string, Entry>()
  const pending = new Map<string, Promise<Entry>>()
  return async function read<T>(key: string, load: () => Promise<T>, serveStale = false, onExpiry?: (expires: number) => void): Promise<T> {
    function deliver(entry: Entry) {
      onExpiry?.(entry.expires)
      return structuredClone(entry.value) as T
    }
    const cached = values.get(key)
    if (cached && cached.expires > Date.now()) return deliver(cached)
    const stale = serveStale ? cached : undefined
    let task = pending.get(key)
    if (!task) {
      task = Promise.resolve().then(load).then(value => {
        if (!values.has(key) && values.size >= capacity) values.delete(values.keys().next().value!)
        const entry = { expires: Date.now() + ttlMs, value: structuredClone(value) }
        values.set(key, entry)
        return entry
      }).catch(error => {
        if (([401, 403, 404, 410].includes(error?.status) || ['unauthorized', 'forbidden', 'not_found', 'gone'].includes(error?.code)) && values.get(key) === cached) values.delete(key)
        throw error
      }).finally(() => { pending.delete(key) })
      pending.set(key, task)
    }
    if (stale) {
      void task.catch(() => {})
      return deliver(stale)
    }
    return deliver(await task)
  }
}
