const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }

/** Rhythm 返回的标题已做 HTML 转义，插值前先还原，避免出现 `&amp;`。 */
export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m
    }
    return NAMED[code.toLowerCase()] ?? m
  })
}

export function articleTitle(a: { articleTitleEmojUnicode?: string; articleTitleEmoj?: string; articleTitle?: string }) {
  return decodeEntities(a.articleTitleEmojUnicode || a.articleTitle || a.articleTitleEmoj || '')
}
