import type { AdItem, AdSlotKey } from '@/types/ads'
import mock from './ads.mock.json' with { type: 'json' }
import { request } from './http'

interface AdsResponse {
  code?: number
  data?: AdItem[] | { slots?: Record<string, string> }
  ads?: AdItem[]
}

/** Rhythm 现网 slot 名 → SPA 广告位 */
const LIVE_SLOT_MAP: Record<string, AdSlotKey> = {
  headerBanner: 'home.top',
  sideFull: 'home.sidebar',
}

const WWADS_SCRIPT = 'https://cdn.wwads.cn/js/makemoney.js'

function fromMock(slot?: AdSlotKey) {
  const items = mock as AdItem[]
  const now = Date.now()
  return items
    .filter((item) => item.enabled)
    .filter((item) => (!item.startsAt || item.startsAt <= now) && (!item.endsAt || item.endsAt >= now))
    .filter((item) => !slot || item.slotKey === slot)
    .sort((a, b) => a.sort - b.sort)
}

function ensureWwadsScript() {
  if (typeof document === 'undefined') return
  if (document.querySelector(`script[data-ad="wwads"]`)) return
  const el = document.createElement('script')
  el.src = WWADS_SCRIPT
  el.async = true
  el.charset = 'UTF-8'
  el.dataset.ad = 'wwads'
  document.head.appendChild(el)
}

function fromLiveSlots(slots: Record<string, string>): AdItem[] {
  const items: AdItem[] = []
  let sort = 0
  for (const [name, html] of Object.entries(slots)) {
    const slotKey = LIVE_SLOT_MAP[name]
    if (!slotKey || !html?.trim()) continue
    sort += 10
    items.push({
      id: `live-${name}`,
      slotKey,
      type: 'html',
      html,
      enabled: true,
      sort,
    })
    if (html.includes('wwads')) ensureWwadsScript()
  }
  return items
}

export async function fetchAds(slot?: AdSlotKey): Promise<AdItem[]> {
  const query = slot ? `?slot=${encodeURIComponent(slot)}` : ''
  try {
    const res = await request<AdsResponse>(`/api/ads${query}`)
    if (res.code === 0 && res.data && !Array.isArray(res.data) && res.data.slots) {
      const live = fromLiveSlots(res.data.slots)
      // 现网 slots 不含页脚友情链，保留 mock 赞助位
      const footer = fromMock('footer.sponsors')
      const merged = [...live, ...footer]
      if (slot) return merged.filter((item) => item.slotKey === slot)
      if (live.length) return merged
    }
    const list = Array.isArray(res.data) ? res.data : res.ads
    if (Array.isArray(list) && list.length) {
      return list.filter((item) => !slot || item.slotKey === slot)
    }
  } catch {
    // Rhythm 广告 API 尚未就绪时走 mock
  }
  return fromMock(slot)
}
