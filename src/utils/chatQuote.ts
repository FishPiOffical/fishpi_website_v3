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
  if (!href) return null
  let url: URL
  try { url = new URL(href, origin) } catch { return null }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search) return null
  return [origin, 'https://fishpi.cn', 'https://yui.fishpi.cn'].includes(url.origin) ? url : null
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
  const nested = extractChatQuotes(template.content, window.location.origin)
  const excerpt = readExcerpt(template.content, '图片消息')
    || nested[0]?.excerpt
    || (source.html ? '' : source.label.split('\n')[0] ?? '')
  return { kind: 'message', href: `/cr#chatroom${source.messageId}`, author: source.userName, excerpt }
}

function extractMessageQuote(block: Element, origin: string): ChatQuote | null {
  const heading = block.previousElementSibling
  if (heading?.tagName !== 'H5' || !/^引用(?:\s|$)/.test(heading.textContent?.trim() ?? '')) return null
  const jump = heading.lastElementChild
  if (jump?.tagName !== 'A' || !/^↩\uFE0F?$/.test(jump.textContent?.trim() ?? '')) return null
  const url = sourceUrl(jump, origin)
  if (!url || !/^\/cr\/?$/.test(url.pathname) || !messageAnchor.test(url.hash)) return null

  const excerpt = readExcerpt(block, '图片消息')
  jump.remove()
  const author = (heading.textContent ?? '').trim().replace(/^引用\s*@?\s*/, '')
  heading.remove()
  return { kind: 'message', href: `/cr${url.hash}`, author, excerpt }
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

export function extractChatQuotes(fragment: DocumentFragment, origin: string): ChatQuote[] {
  const quotes: ChatQuote[] = []
  for (const block of Array.from(fragment.children)) {
    if (block.tagName !== 'BLOCKQUOTE') continue
    const quote = extractMessageQuote(block, origin) ?? extractBreezemoonQuote(block, origin)
    if (!quote) continue
    quotes.push(quote)
    block.remove()
  }
  return quotes
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
