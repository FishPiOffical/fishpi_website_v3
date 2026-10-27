import { getAccessToken, getAuthContextVersion } from '@/api/http'
import { markdownPreview } from '@/api/v3-markdown'

/** Vditor's synchronous transform never inserts its unverified local fallback HTML. */
export function createMarkdownPreview(value: () => string) {
  let target: HTMLElement | null = null, controller: AbortController | null = null, sequence = 0, disposed = false
  function reset() {
    sequence++; controller?.abort(); controller = null
    target?.replaceChildren()
  }
  async function render(element: HTMLElement) {
    if (disposed) return
    reset(); target = element
    if (!getAccessToken()) { element.textContent = '请先登录后再预览'; return }
    const text = value(), version = getAuthContextVersion(), run = sequence
    if (!text) return
    const abort = new AbortController(); controller = abort
    element.textContent = '正在生成预览…'
    const current = () => !disposed && sequence === run && target === element && version === getAuthContextVersion() && !!getAccessToken() && text === value()
    try {
      const html = await markdownPreview(text, abort.signal)
      if (current()) element.innerHTML = html
    } catch (error) {
      if (!current() || abort.signal.aborted) return
      const label = document.createElement('span'); label.textContent = error instanceof Error ? error.message : '预览失败'
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '重试预览'
      retry.addEventListener('click', () => { if (current()) void render(element) })
      element.replaceChildren(label, document.createTextNode(' '), retry)
    } finally { if (controller === abort) controller = null }
  }
  return {
    transform: () => '',
    parse(root: HTMLElement) { const element = root.querySelector<HTMLElement>('.vditor-reset'); if (element) void render(element) },
    reset,
    dispose() { disposed = true; reset(); target = null },
  }
}
