export interface ChatQuote {
  kind: 'message' | 'breezemoon'
  href: string
  author: string
  excerpt: string
}

export interface BreezemoonQuoteSource {
  id: string
  userName: string
  nickname: string
  excerpt: string
}

const sourceLabel = '清风明月'
const authorPrefix = `${sourceLabel} · `
const moonPath = /^\/member\/([A-Za-z0-9_-]{1,64})\/breezemoons\/([1-9][0-9]{0,18})$/
const messageAnchor = /^#chatroom\d{1,32}$/

function escapeMarkdown(text: string) {
  return text.replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]!)
    .replace(/[\\`*_~[\]{}()!#|]/g, '\\$&')
}

export function createBreezemoonQuote(source: BreezemoonQuoteSource, origin: string): ChatQuote | null {
  const path = `/member/${source.userName}/breezemoons/${source.id}`
  if (!moonPath.test(path)) return null
  const excerpt = Array.from(source.excerpt.trim())
  return {
    kind: 'breezemoon',
    href: new URL(path, origin).href,
    author: Array.from(source.nickname.trim().replace(/\s+/g, ' ')).slice(0, 64).join('') || source.userName,
    excerpt: excerpt.length > 280 ? excerpt.slice(0, 279).join('') + '…' : excerpt.join(''),
  }
}

export function breezemoonQuoteMarkdown(quote: ChatQuote) {
  const header = `> [${authorPrefix}${escapeMarkdown(quote.author)}](${quote.href})`
  if (!quote.excerpt) return header
  const excerpt = escapeMarkdown(quote.excerpt.replace(/\r\n?/g, '\n')).split('\n').map(line => `> ${line}`).join('\n')
  return `${header}\n>\n${excerpt}`
}

function sourceUrl(link: Element, origin: string): URL | null {
  const href = link.getAttribute('href')
  return href ? trustedSourceUrl(href, origin) : null
}

function trustedSourceUrl(href: string, origin: string): URL | null {
  if (!href) return null
  let url: URL
  try { url = new URL(href, origin) } catch { return null }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search) return null
  return [origin, 'https://fishpi.cn', 'https://yui.fishpi.cn', 'https://new.fishpi.cn'].includes(url.origin) ? url : null
}

function readExcerpt(content: Element | DocumentFragment, imageLabel: string) {
  for (const lineBreak of content.querySelectorAll('br')) lineBreak.replaceWith(' ')
  for (const emoji of content.querySelectorAll('img.emoji[alt]')) emoji.replaceWith(emoji.getAttribute('alt') ?? '')
  return Array.from(content.childNodes, node => node.textContent?.trim())
    .filter(Boolean).join(' ').replace(/\s+/g, ' ')
    || (content.querySelector('img') ? imageLabel : '')
}

export function chatMessageQuotePreview(source: { messageId: string; userName: string; html: string; label: string }): ChatQuote {
  const template = document.createElement('template')
  template.innerHTML = source.html
  const nested = extractLatestChatQuote(template.content, window.location.origin, source.label)
  const excerpt = readExcerpt(template.content, '图片消息')
    || nested?.excerpt
    || (source.html ? '' : source.label.split('\n')[0] ?? '')
  return { kind: 'message', href: `/cr#chatroom${source.messageId}`, author: source.userName, excerpt }
}

function messageQuoteHeading(block: Element) {
  const heading = block.previousElementSibling
  // 旧站的回跳箭头可能被渲染成 Emoji 图片，标题也可能退化成段落。
  // 以引用前缀和受信任的消息锚点识别，不依赖箭头的文本或图片形式。
  if (!heading || !/^(H[1-6]|P)$/.test(heading.tagName)
    || !/^引用(?:\s|@|$)/.test(heading.textContent?.trim() ?? '')) return null
  const jump = Array.from(heading.querySelectorAll('a')).at(-1)
  if (!jump) return null
  const copy = heading.cloneNode(true) as Element
  Array.from(copy.querySelectorAll('a')).at(-1)?.remove()
  const author = (copy.textContent ?? '').trim().replace(/^引用\s*@?\s*/, '')
  let depth = 0
  for (let parent = block.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === 'BLOCKQUOTE') depth++
  }
  return { heading, jump, author, depth }
}

function originalMessageUrl(href: string, origin: string) {
  const url = trustedSourceUrl(href, origin)
  return url && /^\/cr\/?$/.test(url.pathname) && messageAnchor.test(url.hash) ? `/cr${url.hash}` : null
}

/** 仅恢复生成器的标准引用标记，不把原始 Markdown/HTML 重新插入消息。 */
function recoveredMessageLinks(blocks: Element[], origin: string, source: string): Map<Element, string> {
  const restored = new Map<Element, string>()
  if (!source.includes('#chatroom')) return restored
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const quotedLine = (line: string) => {
    let depth = 0
    while (/^ {0,3}>[ \t]?/.test(line)) {
      line = line.replace(/^ {0,3}>[ \t]?/, '')
      depth++
    }
    return { depth, text: line }
  }
  const markers: { href: string | null; author: string; depth: number }[] = []
  let fence: { depth: number; character: string; length: number } | null = null
  for (let index = 0; index < lines.length; index++) {
    const line = quotedLine(lines[index]!)
    if (fence && line.depth < fence.depth) fence = null
    if (fence) {
      const end = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line.text)
      if (line.depth === fence.depth && end?.[1]?.[0] === fence.character && end[1].length >= fence.length) fence = null
      continue
    }
    const start = /^ {0,3}(`{3,}|~{3,})/.exec(line.text)
    if (start) {
      fence = { depth: line.depth, character: start[1]![0]!, length: start[1]!.length }
      continue
    }
    const marker = /^ {0,3}##### 引用 (?:@(.+?) )?\[↩\]\(([^\s)]+) "跳转至原消息"\) *$/.exec(line.text)
    if (!marker) continue
    let next = index + 1
    while (next < lines.length && !quotedLine(lines[next]!).text.trim()) next++
    // 被引用正文自身可能以手写引用开头，因此首行可比外层标记多出不止一层。
    if (next >= lines.length || quotedLine(lines[next]!).depth < line.depth + 1) continue
    markers.push({
      href: originalMessageUrl(marker[2]!, origin),
      author: (marker[1] ?? '').replace(/\\([\\`*_[\]<>!#|])/g, '$1').trim(),
      depth: line.depth,
    })
  }
  const headings = blocks.flatMap(block => {
    const details = messageQuoteHeading(block)
    return details ? [{ block, ...details }] : []
  })
  // 原文和已清洗结构必须逐个一致；数量、作者、嵌套层级或已知链接不符时不猜对应关系。
  if (!markers.length || markers.length !== headings.length) return restored
  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index]!, marker = markers[index]!
    const href = heading.jump.getAttribute('href')
    if (heading.author !== marker.author || heading.depth !== marker.depth
      || (href !== null && originalMessageUrl(href, origin) !== marker.href)) return restored
  }
  for (let index = 0; index < headings.length; index++) {
    const { block, jump } = headings[index]!, marker = markers[index]!
    const arrow = jump.textContent?.trim() === '↩'
      || (jump.children.length === 1 && jump.firstElementChild?.tagName === 'IMG'
        && jump.firstElementChild.getAttribute('alt') === ':leftwards_arrow_with_hook:')
    if (marker.href && !jump.hasAttribute('href') && jump.getAttribute('title') === '跳转至原消息' && arrow) {
      restored.set(block, marker.href)
    }
  }
  return restored
}

function extractMessageQuote(block: Element, origin: string, recoveredHref?: string): ChatQuote | null {
  const details = messageQuoteHeading(block)
  if (!details) return null
  const { heading, jump, author } = details
  const url = sourceUrl(jump, origin)
  const href = url && originalMessageUrl(url.href, origin) || recoveredHref
  if (!href) return null

  const excerpt = readExcerpt(block, '图片消息')
  heading.remove()
  return { kind: 'message', href, author, excerpt }
}

function extractBreezemoonQuote(block: Element, origin: string): ChatQuote | null {
  const first = block.firstElementChild
  const header = first?.tagName === 'P' ? first : block
  const firstNode = Array.from(header.childNodes).find(node => node.nodeType !== 3 || node.textContent?.trim())
  if (firstNode?.nodeName !== 'A') return null
  const link = firstNode as HTMLAnchorElement
  const label = link.textContent?.trim() ?? ''
  if (label !== sourceLabel && !label.startsWith(authorPrefix)) return null
  const url = sourceUrl(link, origin)
  const match = url && moonPath.exec(url.pathname)
  if (!url || !match || url.hash) return null

  link.remove()
  return {
    kind: 'breezemoon',
    href: url.href,
    author: label.slice(authorPrefix.length).trim() || match[1]!,
    excerpt: readExcerpt(block, '图片动态'),
  }
}

export function extractLatestChatQuote(fragment: DocumentFragment, origin: string, source = ''): ChatQuote | null {
  const blocks = Array.from(fragment.querySelectorAll('blockquote'))
  const recovered = recoveredMessageLinks(blocks, origin, source)
  let latest: ChatQuote | null = null
  const ancestors = new Set<Element>()
  // 从后往前找到最后一条引用。若它嵌在另一条引用里，显示直接引用的外层。
  for (const block of blocks.reverse()) {
    const quote = extractMessageQuote(block, origin, recovered.get(block)) ?? extractBreezemoonQuote(block, origin)
    if (!quote) continue
    if (!latest) {
      latest = quote
      for (let parent = block.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName === 'BLOCKQUOTE') ancestors.add(parent)
      }
    } else if (ancestors.has(block)) {
      latest = quote
    }
    // 仍移除所有已识别的引用，避免旧引用回到正文或混入外层摘要。
    block.remove()
  }
  return latest
}

/** Markdown 渲染器包装引用后可能留下空段落，不能把这些占位当成消息正文。 */
export function hasChatQuoteBody(fragment: DocumentFragment): boolean {
  const isPlaceholder = (node: Node): boolean => {
    if (node.nodeType === 3) return !node.textContent?.trim()
    if (node.nodeType === 8 || node.nodeName === 'BR') return true
    return ['P', 'DIV', 'SPAN'].includes(node.nodeName) && Array.from(node.childNodes).every(isPlaceholder)
  }
  return !Array.from(fragment.childNodes).every(isPlaceholder)
}
