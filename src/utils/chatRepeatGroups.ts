import type { ChatLine } from '@/stores/chat'

export interface RepeatEntry { key: string; message: ChatLine | null; notice?: { kind: string } | null }
export type RepeatPreviewPart = { text: string } | { image: string; alt: string }

// 后层仅投影已有正文的文字和图片，不挂载表态、用户资料等有读取行为的组件。
export function chatRepeatPreview(html: string): RepeatPreviewPart[] {
  if (typeof document === 'undefined') return []
  const template = document.createElement('template')
  template.innerHTML = html
  const parts: RepeatPreviewPart[] = []
  function visit(node: Node) {
    if (node.nodeType === 3) { parts.push({ text: node.textContent || '' }); return }
    if (node.nodeType !== 1) return
    const element = node as Element
    if (element.tagName === 'IMG') {
      const image = element.getAttribute('src') || ''
      if (repeatImageSource(image)) parts.push({ image, alt: element.getAttribute('alt') || '图片' })
      return
    }
    if (!['P', 'BR', 'STRONG', 'EM', 'S', 'DEL', 'CODE'].includes(element.tagName)) return
    element.childNodes.forEach(visit)
    if (['P', 'BR'].includes(element.tagName)) parts.push({ text: ' ' })
  }
  template.content.childNodes.forEach(visit)
  return parts
}
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
  let previousGroup: T[] | undefined
  for (const entry of entries) {
    // 进出场和领取提示独立保留，不参与正文比较，也不打断连续复读。
    if (!entry.message && entry.notice && ['join', 'leave', 'claim'].includes(entry.notice.kind)) {
      groups.push([entry])
      continue
    }
    const key = repeatKey(entry.message)
    if (key !== null && key === previous && previousGroup) {
      previousGroup.push(entry)
      // 以组内最新消息定位整叠，穿插的通知仍在列表中各自显示一次。
      const index = groups.indexOf(previousGroup)
      if (index !== groups.length - 1) { groups.splice(index, 1); groups.push(previousGroup) }
    } else {
      previousGroup = [entry]
      groups.push(previousGroup)
    }
    previous = key
  }
  return groups
}
