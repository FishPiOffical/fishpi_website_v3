export const bubbleMotifs = ['none', 'paw', 'leaf', 'bell', 'fish'] as const
export type BubbleMotif = typeof bubbleMotifs[number]
const colors = ['background', 'ownBackground', 'border', 'ink', 'text'] as const
export type BubblePalette = Record<typeof colors[number], string>
export interface BubbleStyle {
  light: BubblePalette
  dark: BubblePalette
  radius: number
  borderWidth: number
  shadow: boolean
  motif: BubbleMotif
  image: string
}

export function isCustomBubbleId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 32 && /^bubble-custom-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function palette(value: unknown): BubblePalette | undefined {
  const row = record(value)
  if (!row) return
  const values = colors.map(key => row[key])
  if (!values.every(color => typeof color === 'string' && /^#[a-fA-F0-9]{6}$/.test(color))) return
  return Object.fromEntries(colors.map((key, index) => [key, values[index]])) as BubblePalette
}

export function isBubbleImage(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 512) return false
  return value === '' || /^https:\/\/(?:file|pic)\.fishpi\.cn\/[a-zA-Z0-9/_-][a-zA-Z0-9/_.-]*\.(?:png|webp|jpg|jpeg|avif)$/.test(value)
    && !value.includes('..')
}

export function decodeBubbleStyle(value: unknown): BubbleStyle | undefined {
  const row = record(value)
  if (!row) return
  const light = palette(row.light), dark = palette(row.dark)
  const { radius, borderWidth, shadow, motif, image } = row
  if (!light || !dark || typeof radius !== 'number' || !Number.isInteger(radius) || radius < 6 || radius > 24
      || typeof borderWidth !== 'number' || !Number.isInteger(borderWidth) || borderWidth < 0 || borderWidth > 2
      || typeof shadow !== 'boolean' || !bubbleMotifs.some(item => item === motif) || !isBubbleImage(image)) return
  return { light, dark, radius, borderWidth, shadow, motif: motif as BubbleMotif, image }
}

export function bubbleAttributes(value: BubbleStyle | undefined, own = false) {
  if (!value) return {}
  return {
    class: 'managed-bubble',
    'data-motif': value.image ? 'image' : value.motif,
    'data-own': own,
    'data-shadow': value.shadow,
    style: {
      '--bubble-fill': own ? value.light.ownBackground : value.light.background,
      '--bubble-fill-dark': own ? value.dark.ownBackground : value.dark.background,
      '--bubble-border': value.light.border,
      '--bubble-border-dark': value.dark.border,
      '--bubble-ink': value.light.ink,
      '--bubble-ink-dark': value.dark.ink,
      '--bubble-text': value.light.text,
      '--bubble-text-dark': value.dark.text,
      '--bubble-radius': value.radius + 'px',
      '--bubble-border-width': value.borderWidth + 'px',
    },
  }
}
