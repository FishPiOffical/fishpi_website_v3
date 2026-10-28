export interface DomainItem {
  uri: string
  domainTitle: string
  domainDescription?: string
  domainArticleCount?: number
  domainTags?: string
  domainIconPath?: string
  /** Rhythm 字段别名，归一化后写入 uri */
  domainURI?: string
  articleCnt?: number
}

