import type { AdItem, AdSlotKey } from '@/types/ads'

/**
 * 广告仅保留挂载入口（AdSlot / slotKey），本阶段不拉取现网或 mock 素材。
 * 需要恢复投放时再接 GET /api/ads 与 wwads。
 */
export async function fetchAds(_slot?: AdSlotKey): Promise<AdItem[]> {
  return []
}
