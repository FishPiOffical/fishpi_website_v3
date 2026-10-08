export interface MusicCard {
  msgType: 'music'
  title?: string
  coverURL?: string
  source?: string
  from?: string
}

export interface WeatherCard {
  msgType: 'weather'
  t?: string
  st?: string
  date?: string | string[]
  weatherCode?: string | string[]
  max?: string | number[] | string[]
  min?: string | number[] | string[]
}

export type ChatCardData = MusicCard | WeatherCard

const CARD_TYPES = new Set(['music', 'weather'])

export function parseChatCard(content: unknown): ChatCardData | undefined {
  let data = content
  if (typeof data === 'string') {
    if (!data.trim().startsWith('{')) return undefined
    try {
      data = JSON.parse(data)
    } catch {
      return undefined
    }
  }
  if (data && typeof data === 'object' && CARD_TYPES.has((data as { msgType?: string }).msgType || '')) {
    return data as ChatCardData
  }
  return undefined
}
