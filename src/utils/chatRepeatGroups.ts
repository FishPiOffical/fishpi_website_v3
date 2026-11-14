import type { ChatLine } from '@/stores/chat'

export interface RepeatEntry { key: string; message: ChatLine | null }
// 仅去掉已知图床的缩放指令；签名、其他查询参数及第三方地址完整保留。
export function repeatImageSource(source: string): string | null {
  try {
    const url = new URL(source)
    if (!['https:', 'http:'].includes(url.protocol)) return null
    if (url.hostname !== 'file.fishpi.cn') return source
    url.pathname = url.pathname.replace(/\/w\/\d+(?:\/h\/\d+)?$/, '')
    const query = url.search.slice(1).split('&').filter(part =>
      !/^imageView2\/[12]\/w\/\d+(?:\/h\/\d+)?$/.test(part))
    url.search = query.filter(Boolean).join('&')
    return url.href
  } catch { return null }
}

// 用清洗后的正文结构识别图片，不读取图片资源、不补查消息或用户。
function imageRepeatKey(html: string): string | null {
  if (typeof document === 'undefined') return null
  const template = document.createElement('template')
  template.innerHTML = html
  let images = 0, valid = true
  const parts: unknown[] = []
  function visit(node: Node) {
    if (node.nodeType === 3) { parts.push(['text', node.textContent]); return }
    if (node.nodeType !== 1) { valid = false; return }
    const element = node as Element, tag = element.tagName.toLowerCase()
    if (tag === 'img') {
      const source = repeatImageSource(element.getAttribute('src') || '')
      if (!source) { valid = false; return }
      images++
      parts.push(['image', source])
      return
    }
    // 保留段落、换行与文字格式；引用、链接和特殊卡片仍不自动折叠。
    if (!['p', 'br', 'strong', 'em', 's', 'del', 'code'].includes(tag)) { valid = false; return }
    parts.push(['open', tag])
    element.childNodes.forEach(visit)
    parts.push(['close', tag])
  }
  template.content.childNodes.forEach(visit)
  return valid && images > 0 ? JSON.stringify(['images', parts]) : null
}

export function repeatKey(line: ChatLine | null): string | null {
  if (!line || line.redPacket || line.card || !line.content?.trim() || !line.html) return null
  if (/^\s*>/m.test(line.content)) return null
  if (/<img\b/i.test(line.html)) return imageRepeatKey(line.html)
  // 纯文字维持原来的精确比较，不抹掉空白或格式差异。
  if (/<(?!\/?p(?:\s|>)|br\s*\/?\s*>)[a-z]/i.test(line.html)) return null
  return JSON.stringify(['text', line.content])
}
export function groupChatRepeats<T extends RepeatEntry>(entries: T[]): T[][] {
  const groups: T[][] = []
  let previous: string | null = null
  for (const entry of entries) {
    const key = repeatKey(entry.message)
    if (key !== null && key === previous) groups[groups.length - 1]!.push(entry)
    else groups.push([entry])
    previous = key
  }
  return groups
}
