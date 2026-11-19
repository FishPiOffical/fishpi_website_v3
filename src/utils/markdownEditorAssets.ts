export const VDITOR_CDN = 'https://file.fishpi.cn/vditor/latest/dist'
export const VDITOR_SCRIPT = `${VDITOR_CDN}/index.min.js`

const VDITOR_STYLES = `${VDITOR_CDN}/index.css`

export interface VditorInstance {
  readonly vditor?: { lute?: { GetEmojis(): Record<string, unknown> } }
  focus(): void
  getValue(): string
  setValue(value: string, clearStack?: boolean): void
  insertMD(value: string): void
  setTheme(theme: 'classic' | 'dark', contentTheme?: string, codeTheme?: string, contentThemePath?: string): void
  destroy(): void
}
export type VditorCtor = new (el: HTMLElement, options: Record<string, unknown>) => VditorInstance

let stylesReady: Promise<void> | undefined
let scriptReady: Promise<VditorCtor> | undefined

function loadStyles() {
  if (stylesReady) return stylesReady
  const existing = document.querySelector<HTMLLinkElement>(`link[rel~="stylesheet"][href="${VDITOR_STYLES}"]`)
  if (existing?.sheet) return Promise.resolve()
  const link = existing ?? document.createElement('link')
  stylesReady = new Promise<void>((resolve, reject) => {
    link.addEventListener('load', () => resolve(), { once: true })
    link.addEventListener('error', () => {
      link.remove()
      stylesReady = undefined
      reject(new Error('编辑器样式加载失败'))
    }, { once: true })
    if (!existing) {
      link.rel = 'stylesheet'
      link.href = VDITOR_STYLES
      document.head.appendChild(link)
    }
  })
  return stylesReady
}

function loadScript() {
  const w = window as Window & { Vditor?: VditorCtor }
  if (w.Vditor) return Promise.resolve(w.Vditor)
  if (scriptReady) return scriptReady
  const script = document.createElement('script')
  scriptReady = new Promise<VditorCtor>((resolve, reject) => {
    script.onload = () => w.Vditor ? resolve(w.Vditor) : reject(new Error('Vditor 未注册'))
    script.onerror = () => reject(new Error('编辑器加载失败'))
    script.src = VDITOR_SCRIPT
    document.head.appendChild(script)
  }).catch(error => {
    script.remove()
    scriptReady = undefined
    throw error
  })
  return scriptReady
}

export async function loadVditor() {
  const [, ctor] = await Promise.all([loadStyles(), loadScript()])
  return ctor
}

export function preloadMarkdownEditor() {
  // 两个 URL 与 Vditor 实际插入的经典脚本保持一致，以复用在途请求或缓存。
  for (const url of [VDITOR_SCRIPT, `${VDITOR_CDN}/js/lute/lute.min.js`]) {
    if (document.querySelector(`script[src="${url}"], link[rel="preload"][href="${url}"]`)) continue
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'script'
    link.href = url
    link.setAttribute('fetchpriority', 'low')
    link.addEventListener('error', () => link.remove(), { once: true })
    document.head.appendChild(link)
  }
}
