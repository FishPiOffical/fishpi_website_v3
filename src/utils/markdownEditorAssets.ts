export const VDITOR_CDN = 'https://file.fishpi.cn/vditor/latest/dist'
export const VDITOR_SCRIPT = `${VDITOR_CDN}/index.min.js`

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
