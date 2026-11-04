import { getApiMode } from './mode'
import { ApiError } from './http'
import { v3ArticleFeedPage, v3Tags, adaptV3Tag } from './v3-content'
import { decodePublicArticleSummary } from './v3-article-list'
import { decodePublicColumnCard, fetchPublicColumnCards, type PublicColumn } from './v3-public-columns'
import type { ArticleSummary, TagItem } from './fishpi'
export type HomeData = { recent: ArticleSummary[]; hot: ArticleSummary[]; columnsRecent: PublicColumn[]; columnsHot: PublicColumn[]; tags: TagItem[] }
export type HomeRead = keyof HomeData
export const homeReadKeys = ['recent', 'hot', 'columnsRecent', 'columnsHot', 'tags'] as const
export type HomeBootstrap = { [K in HomeRead]: HomeData[K] | null }
const limits = { recent: 40, hot: 12, columnsRecent: 8, columnsHot: 8, tags: 24 }
const invalid = () => new ApiError('首页资源响应格式不正确', 502)
export function decodeHomeRead<K extends HomeRead>(key: K, value: unknown): HomeData[K] {
  if (!homeReadKeys.includes(key) || !Array.isArray(value) || value.length > limits[key]) throw invalid()
  const list = key === 'recent' || key === 'hot' ? value.map(decodePublicArticleSummary)
    : key === 'tags' ? value.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalid()
      if(getApiMode()==='v1') {
        const r=item as Record<string,unknown>
        if(['tagURI','tagTitle','tagDescription','tagIconPath'].some(k=>typeof r[k]!=='string') || typeof r.tagReferenceCount!=='number' || !Number.isSafeInteger(r.tagReferenceCount) || r.tagReferenceCount<0) throw invalid()
        return {tagURI:r.tagURI,tagTitle:r.tagTitle,tagDescription:r.tagDescription,tagIconPath:r.tagIconPath,tagReferenceCount:r.tagReferenceCount} as TagItem
      }
      return adaptV3Tag({ id: item.tagURI, title: item.tagTitle, description: item.tagDescription, iconURL: item.tagIconPath, articleCount: item.tagReferenceCount })
    }) : value.map(decodePublicColumnCard)
  const ids = list.map(item => 'oId' in item ? item.oId : 'id' in item ? item.id : item.tagURI)
  if (new Set(ids).size !== list.length) throw invalid()
  return list as HomeData[K]
}
export function decodeHomeBootstrap(value: unknown): HomeBootstrap {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const result: HomeBootstrap = { recent: null, hot: null, columnsRecent: null, columnsHot: null, tags: null }
  for (const key of homeReadKeys) { try { (result[key] as unknown) = decodeHomeRead(key, raw[key]) } catch { /* Failed or invalid preload remains unknown, never fake empty. */ } }
  return result
}
export async function fetchHomeRead<K extends HomeRead>(key: K): Promise<HomeData[K]> {
  if (!homeReadKeys.includes(key)) throw new ApiError('首页资源不合法', 422)
  if(getApiMode()==='v1') {const {legacyHomeRead}=await import('./legacy/home');return decodeHomeRead(key,await legacyHomeRead(key))}
  const list = key === 'recent' || key === 'hot' ? (await v3ArticleFeedPage(key, 1, limits[key])).list
    : key === 'tags' ? (await v3Tags(1, limits[key])).tags
    : (await fetchPublicColumnCards(key === 'columnsRecent' ? 'latest' : 'hot', 1, limits[key])).list
  return decodeHomeRead(key, list)
}
/** Public SSR only. A failed resource is null; a legitimate empty result is []. */
export async function fetchHomeBootstrap(): Promise<HomeBootstrap> {
  const results = await Promise.allSettled(homeReadKeys.map(key => fetchHomeRead(key)))
  return decodeHomeBootstrap(Object.fromEntries(homeReadKeys.map((key, index) => [key, results[index]!.status === 'fulfilled' ? results[index]!.value : null])))
}
