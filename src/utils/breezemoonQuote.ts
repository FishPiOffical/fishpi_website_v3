export interface BreezemoonQuote {
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

function escapeMarkdown(text: string) {
  return text.replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]!)
    .replace(/[\\`*_~[\]{}()!#|]/g, '\\$&')
}

export function createBreezemoonQuote(source: BreezemoonQuoteSource, origin: string): BreezemoonQuote | null {
  const path = `/member/${source.userName}/breezemoons/${source.id}`
  if (!moonPath.test(path)) return null
  const excerpt = Array.from(source.excerpt.trim())
  return {
    href: new URL(path, origin).href,
    author: Array.from(source.nickname.trim().replace(/\s+/g, ' ')).slice(0, 64).join('') || source.userName,
    excerpt: excerpt.length > 280 ? excerpt.slice(0, 279).join('') + '…' : excerpt.join(''),
  }
}

export function breezemoonQuoteMarkdown(quote: BreezemoonQuote) {
  const header = `> [${authorPrefix}${escapeMarkdown(quote.author)}](${quote.href})`
  if (!quote.excerpt) return header
  const excerpt = escapeMarkdown(quote.excerpt.replace(/\r\n?/g, '\n')).split('\n').map(line => `> ${line}`).join('\n')
  return `${header}\n>\n${excerpt}`
}

export function extractBreezemoonQuotes(fragment: DocumentFragment, origin: string): BreezemoonQuote[] {
  const quotes: BreezemoonQuote[] = []
  for (const block of Array.from(fragment.children)) {
    if (block.tagName !== 'BLOCKQUOTE') continue
    const first = block.firstElementChild
    const header = first?.tagName === 'P' ? first : block
    const firstNode = Array.from(header.childNodes).find(node => node.nodeType !== 3 || node.textContent?.trim())
    if (firstNode?.nodeName !== 'A') continue
    const link = firstNode as HTMLAnchorElement
    const label = link.textContent?.trim() ?? ''
    if (label !== sourceLabel && !label.startsWith(authorPrefix)) continue
    const rawHref = link.getAttribute('href')
    if (!rawHref) continue
    let url: URL
    try { url = new URL(rawHref, origin) } catch { continue }
    const match = moonPath.exec(url.pathname)
    if (!match || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) continue
    if (url.origin !== origin && url.origin !== 'https://fishpi.cn' && url.origin !== 'https://yui.fishpi.cn') continue

    link.remove()
    for (const lineBreak of block.querySelectorAll('br')) lineBreak.replaceWith(' ')
    const excerpt = Array.from(block.childNodes, node => node.textContent?.trim()).filter(Boolean).join(' ')
    quotes.push({
      href: url.href,
      author: label.slice(authorPrefix.length).trim() || match[1]!,
      excerpt: excerpt || (block.querySelector('img:not(.emoji)') ? '图片动态' : ''),
    })
    block.remove()
  }
  return quotes
}
