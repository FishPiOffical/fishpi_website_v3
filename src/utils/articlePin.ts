import type { ArticleSummary } from '@/api/fishpi'

export type PinnableArticle = Pick<ArticleSummary, 'stick' | 'articleStick'>

export function articlePinKind(article: PinnableArticle) {
  // 以服务端当前状态为准，明确取消置顶时不能被旧字段重新点亮。
  if (article.stick) {
    if (!article.stick.active) return undefined
    return article.stick.permanent ? 'permanent' : 'temporary'
  }
  return article.articleStick ? 'pinned' : undefined
}
