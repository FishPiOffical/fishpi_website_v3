type Snapshot = { key: string; savedAt: number; value: unknown }
export const HOME_MAX_AGE = 600_000
export const DIRECTORY_MAX_AGE = 3_600_000
export function memberSnapshotKey(name: string) { return `member:${name.toLowerCase()}` }

const storeName = 'snapshots'
let opening: Promise<IDBDatabase | null> | undefined

function database() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return opening ??= new Promise<IDBDatabase | null>(resolve => {
    try {
      const request = indexedDB.open('fishpi-public-snapshots-v1', 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore(storeName, { keyPath: 'key' }).createIndex('savedAt', 'savedAt')
      }
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); opening = undefined }
        resolve(request.result)
      }
      request.onerror = request.onblocked = () => resolve(null)
    } catch { resolve(null) }
  })
}

function storageKey(key: string) {
  // IndexedDB is already isolated by browser origin. Also isolate configured API origins.
  return `${import.meta.env?.VITE_BROWSER_API_ORIGIN || ''}|${key}`
}

export async function readPublicSnapshot<T>(key: string, maxAge: number, decode: (value: unknown) => T) {
  if (typeof indexedDB === 'undefined') return null
  let timer: ReturnType<typeof setTimeout> | undefined
  const read = async () => {
    const db = await database()
    if (!db) return null
    const entry = await new Promise<Snapshot | undefined>((resolve, reject) => {
      const request = db.transaction(storeName).objectStore(storeName).get(storageKey(key))
      request.onsuccess = () => resolve(request.result)
      request.onerror = reject
    })
    if (!entry || !Number.isFinite(entry.savedAt)) return null
    const age = Date.now() - entry.savedAt
    if (age < 0 || age >= maxAge) return null
    return { value: decode(entry.value), expires: entry.savedAt + maxAge }
  }
  try {
    return await Promise.race([read(), new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 120) })])
  } catch { return null }
  finally { clearTimeout(timer) }
}

export function savePublicSnapshot(key: string, value: unknown) {
  // Strip reactive proxies before the asynchronous write. Keep each record bounded.
  if (typeof indexedDB === 'undefined') return
  try {
    const json = JSON.stringify(value)
    if (!json || json.length > 128_000) return
    const entry: Snapshot = { key: storageKey(key), savedAt: Date.now(), value: JSON.parse(json) }
    void database().then(db => {
      if (!db) return
      const store = db.transaction(storeName, 'readwrite').objectStore(storeName)
      store.put(entry)
      const keys = store.index('savedAt').getAllKeys()
      keys.onsuccess = () => { for (const key of keys.result.slice(0, -80)) store.delete(key) }
    }).catch(() => {})
  } catch { /* Storage is optional. */ }
}

export function removePublicSnapshot(key: string) {
  void database().then(db => db?.transaction(storeName, 'readwrite').objectStore(storeName).delete(storageKey(key))).catch(() => {})
}

export function canKeepPublicSnapshot(error: unknown) {
  const failure = error as { status?: number; code?: string }
  return failure?.code === 'offline' || failure?.status === 429 || (failure?.status ?? 0) >= 500
}
