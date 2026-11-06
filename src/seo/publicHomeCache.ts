/** Only anonymous homepage DTOs belong here; never cache an app, HTML or private state. */
export function createPublicHomeCache(ttlMs = 15_000, capacity = 16) {
  const values = new Map<string, { expires: number; value: unknown }>()
  const pending = new Map<string, Promise<unknown>>()
  return async function read<T>(key: string, load: () => Promise<T>): Promise<T> {
    const cached = values.get(key)
    if (cached && cached.expires > Date.now()) return structuredClone(cached.value) as T
    values.delete(key)
    let task = pending.get(key)
    if (!task) {
      task = Promise.resolve().then(load).then(value => {
        if (values.size >= capacity) values.delete(values.keys().next().value!)
        values.set(key, { expires: Date.now() + ttlMs, value: structuredClone(value) })
        return value
      }).finally(() => { pending.delete(key) })
      pending.set(key, task)
    }
    return structuredClone(await task) as T
  }
}
