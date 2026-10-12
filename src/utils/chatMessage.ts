/** SSR 与客户端使用同一规则；只有无正文、无引用的单张图片才独立展示。 */
export function isSingleImageMessage(html: string): boolean {
  const content = html.replace(/<!--[\s\S]*?-->/g, '')
  const tags = content.match(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g) || []
  const images = tags.filter((tag) => /^<img\b/i.test(tag))
  if (images.length !== 1) return false
  const image = images[0]!
  const classes = image.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
  if ((classes?.[1] || classes?.[2] || classes?.[3] || '').split(/\s+/).includes('emoji')) return false
  const source = image.match(/\s(?:src|data-src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+))/i)
  if (!(source?.[1] || source?.[2] || source?.[3] || '').trim()) return false
  if (tags.some((tag) => !/^<\/?(?:img|p|div|span|a|picture|source|br)\b/i.test(tag))) return false
  const text = content
    .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, '')
    .replace(/&nbsp;|&#(?:160|32);|&#x(?:a0|20);/gi, ' ')
    .trim()
  return text.length === 0
}
