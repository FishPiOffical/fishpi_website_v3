/** 路由交接短暂无人使用时保留连接，避免旧页卸载抢先断开新页的订阅。 */
export function createChatConnectionOwners(start: () => void, stop: () => void, graceMs = 500) {
  const owners = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  return {
    acquire(owner: string) {
      clearTimeout(timer); timer = undefined
      owners.add(owner)
      if (!running) { running = true; start() }
    },
    release(owner: string) {
      if (!owners.delete(owner) || owners.size || timer) return
      timer = setTimeout(() => {
        timer = undefined
        if (!owners.size && running) { running = false; stop() }
      }, graceMs)
    },
    dispose() { clearTimeout(timer); owners.clear(); if (running) stop(); running = false },
  }
}
