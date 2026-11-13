import type { PetActivityKind, PetCatalog } from '@/api/v3-pets'

export type PetHomeSection = 'care' | 'activities' | 'stories' | 'shop' | 'workshop' | 'history'
export type PetHomeTarget =
  | { section: 'activities'; kind?: PetActivityKind; entryId?: string }
  | { section: 'shop'; itemId?: string }
  | { section: 'care'; anchor?: 'supplies' }
  | { section: Exclude<PetHomeSection, 'activities' | 'shop' | 'care'> }

export interface PetMaterialSource {
  name: string
  target: Extract<PetHomeTarget, { section: 'activities' | 'shop' }>
}

/** 只展示当前目录明确提供的来源，不从说明文字推测掉落或出售资格。 */
export function getPetMaterialSources(catalog: PetCatalog | null, itemId: string): PetMaterialSource[] {
  const item = catalog?.items.find(value => value.id === itemId && value.category === 'material')
  if (!catalog || !item) return []
  const sources: PetMaterialSource[] = catalog.places
    .filter(place => place.rewards.items.some(reward => reward.itemId === itemId && reward.quantity > 0))
    .map(place => ({ name: place.name, target: { section: 'activities', kind: 'outing', entryId: place.id } }))
  if (item.price !== null) sources.push({ name: '家园小铺', target: { section: 'shop', itemId } })
  return sources
}

export const PET_ACTIVITIES_NAVIGATION_EVENT = 'fishpi:pet-activities-navigation'

/** 同一地址再次点击桌宠入口时也打开活动区，不依赖路由重复导航。 */
export function requestPetActivitiesNavigation(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || typeof window === 'undefined') return
  window.dispatchEvent(new Event(PET_ACTIVITIES_NAVIGATION_EVENT))
}
