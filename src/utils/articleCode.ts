import type { ObjectDirective } from 'vue'
import '@/styles/article-code.css'

type ArticleCodeInput = readonly [html: string, markdown?: string]

function fenceLanguages(markdown: string) {
  const languages = new Map<string, string>()
  let fence: { marker: string; indent: number; language: string; lines: string[] } | undefined
  for (const line of markdown.split(/\r\n?|\n/)) {
    if (!fence) {
      const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line)
      if (match && !(match[2][0] === '`' && match[3].includes('`'))) {
        fence = { marker: match[2], indent: match[1].length, language: match[3].trim().split(/\s+/, 1)[0].toLowerCase() || 'plaintext', lines: [] }
      }
    } else {
      const close = /^ {0,3}(`+|~+)[ \t]*$/.exec(line)
      if (close && close[1].startsWith(fence.marker)) {
        const body = fence.lines.join('\n')
        languages.set(body, languages.has(body) && languages.get(body) !== fence.language ? 'plaintext' : fence.language)
        fence = undefined
      } else {
        fence.lines.push(line.slice(Math.min(fence.indent, line.match(/^ */)![0].length)))
      }
    }
  }
  return languages
}

async function enhance(root: HTMLElement, [, markdown]: ArticleCodeInput) {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('pre > code:not(.hljs)'))
  if (!blocks.length) return
  const { default: highlighter } = await import('highlight.js/lib/common')
  const hints = fenceLanguages(markdown || '')
  let budget = 128_000
  for (const code of blocks) {
    if (!root.isConnected || !root.contains(code) || code.matches('.hljs') || code.querySelector(':not(span)')) continue
    const text = code.textContent || ''
    if (!text || text.length > 24_000 || text.length > budget) continue
    const language = /(?:^|\s)(?:lang|language)-([^\s]+)/i.exec(code.className)?.[1] ?? hints.get(text.replace(/\n$/, ''))
    if (language && !highlighter.getLanguage(language)) continue
    budget -= text.length
    const result = language ? highlighter.highlight(text, { language, ignoreIllegals: true })
      : text.length <= 4000 ? highlighter.highlightAuto(text, ['javascript', 'python', 'java', 'json', 'bash', 'xml', 'css', 'sql']) : null
    if (result?.language) {
      code.innerHTML = result.value
      code.classList.add('hljs')
    }
  }
}

function render(root: HTMLElement, input: ArticleCodeInput) {
  void enhance(root, input).catch(() => { /* 高亮不可用时保留服务端正文。 */ })
}

export const vArticleCode: ObjectDirective<HTMLElement, ArticleCodeInput> = {
  mounted(root, { value }) { render(root, value) },
  updated(root, { value, oldValue }) {
    if (value[0] !== oldValue?.[0] || value[1] !== oldValue?.[1]) render(root, value)
  },
}
