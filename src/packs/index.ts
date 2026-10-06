export type PackKind = 'theme' | 'bubble' | 'frame'

export interface PackMeta {
  id: string
  kind: PackKind
  name: string
  vip: boolean
  preview: string
}

const packJson = import.meta.glob('./**/pack.json', { eager: true, import: 'default' }) as Record<
  string,
  PackMeta
>
const packCss = import.meta.glob('./**/style.css', { eager: true })

void packCss

export const packs: PackMeta[] = Object.values(packJson)

export function packsOf(kind: PackKind) {
  return packs.filter((p) => p.kind === kind)
}

export function findPack(kind: PackKind, id: string) {
  return packsOf(kind).find((p) => p.id === id)
}

export const DEFAULT_THEME = 'classic-dark'
export const DEFAULT_BUBBLE = 'classic'
export const DEFAULT_FRAME = 'none'
