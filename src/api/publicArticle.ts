import type { ArticleComment, ArticleDetail } from '@/api/fishpi'
import { fetchPublicHtml } from '@/api/publicHome'

function text(el: Element | null) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim()
}

export function parseArticleHtml(html: string, id: string): ArticleDetail {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  if (/401 Unauthorized/.test(doc.title)) throw new Error('这篇帖子需要登录后查看')
  const title = text(doc.querySelector('h1.article-title'))
  const content = doc.querySelector('.article-content')?.innerHTML?.trim() || ''
  if (!title || !content) throw new Error('公开帖子没有解析到正文')

  const authorHref = doc.querySelector('.article__meta a[rel="author"]')?.getAttribute('href') || ''
  const author = decodeURIComponent(authorHref.split('/member/')[1]?.split(/[?#]/)[0] || '')
  const comments: ArticleComment[] = []
  for (const thread of doc.querySelectorAll('.comment-thread')) {
    const oid = thread.getAttribute('id')?.replace(/^comment-/, '') || thread.querySelector('[data-target-id]')?.getAttribute('data-target-id') || ''
    const body = thread.querySelector('.comment-thread__content')
    const name = text(thread.querySelector('.comment-thread__meta a, .comment-thread__meta b, .comment-thread__meta strong'))
    if (!body) continue
    comments.push({
      oId: oid || String(comments.length),
      commentAuthorName: name,
      commentContent: body.innerHTML,
      timeAgo: text(thread.querySelector('.ft-fade')),
    })
  }

  return {
    oId: id,
    articleTitle: title,
    articleContent: content,
    articleAuthorName: author,
    articleComments: comments,
    articleCommentCount: comments.length,
  }
}

export async function fetchPublicArticle(id: string): Promise<ArticleDetail> {
  const html = await fetchPublicHtml(`/article/${id}`)
  return parseArticleHtml(html, id)
}
