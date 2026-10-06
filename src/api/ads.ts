import type { AdItem, AdSlotKey } from '@/types/ads'
import mock from './ads.mock.json' with { type: 'json' }
import { request } from './http'

interface AdsResponse {
  code?: number
  data?: AdItem[]
  ads?: AdItem[]
}

function fromMock(slot?: AdSlotKey) {
  const items = mock as AdItem[]
  const now = Date.now()
  return items
    .filter((item) => item.enabled)
    .filter((item) => (!item.startsAt || item.startsAt <= now) && (!item.endsAt || item.endsAt >= now))
    .filter((item) => !slot || item.slotKey === slot)
    .sort((a, b) => a.sort - b.sort)
}

export async function fetchAds(slot?: AdSlotKey): Promise<AdItem[]> {
  const query = slot ? `?slot=${encodeURIComponent(slot)}` : ''
  try {
    const res = await request<AdsResponse>(`/api/ads${query}`)
    const list = res.data || res.ads
    if (Array.isArray(list) && list.length) {
      return list.filter((item) => !slot || item.slotKey === slot)
    }
  } catch {
    // Rhythm 广告 API 尚未就绪时走 mock，字段与正式约定一致
  }
  return fromMock(slot)
}
