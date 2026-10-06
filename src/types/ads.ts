export type AdSlotKey = 'home.top' | 'footer.sponsors' | 'home.sidebar'

export type AdType = 'image' | 'html' | 'script' | 'link'

export interface AdItem {
  id: string
  slotKey: AdSlotKey
  type: AdType
  title?: string
  imageUrl?: string
  linkUrl?: string
  html?: string
  scriptSrc?: string
  containerAttrs?: Record<string, string>
  badge?: string
  enabled: boolean
  sort: number
  startsAt?: number
  endsAt?: number
}
