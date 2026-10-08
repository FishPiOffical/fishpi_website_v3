export const SITE_NAME = '摸鱼派'
export const SITE_DEFAULT_DESC =
  '摸鱼派是一个年轻人的开放社区，大家在这里坦诚交流，共同成长。'
export const SITE_ORIGIN = (import.meta.env.VITE_SITE_ORIGIN || 'https://fishpi.cn').replace(/\/$/, '')

export function absoluteUrl(path: string) {
  if (!path) return SITE_ORIGIN
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}

export function stripHtml(html: string, max = 160) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

export function pageTitle(title?: string) {
  const t = (title || '').trim()
  if (!t || t === SITE_NAME) return SITE_NAME
  return `${t} - ${SITE_NAME}`
}
