import type { BrawlWeapon } from '@/api/v3-pets'

export const brawlWeaponVisuals = {
  SPOON: { art: 'spoon', motion: 'swing', tone: '#e2a03e', angle: -24 },
  GUARD: { art: 'guard', motion: 'bash', tone: '#c49863', angle: 0 },
  FAN: { art: 'fan', motion: 'swing', tone: '#749cc9', angle: -12 },
  PEBBLE: { art: 'pebble', motion: 'throw', tone: '#818eb8', angle: 0 },
  SHELL: { art: 'shell', motion: 'bash', tone: '#d79091', angle: -8 },
  LEAF: { art: 'leaf', motion: 'swing', tone: '#70ad54', angle: -25 },
  LOTUS: { art: 'lotus', motion: 'cast', tone: '#9aaa59', angle: -12 },
  CLAW: { art: 'claw', motion: 'swing', tone: '#e78c6c', angle: -8 },
  SLING: { art: 'sling', motion: 'throw', tone: '#5eaba1', angle: -12 },
  FIN: { art: 'fin', motion: 'swing', tone: '#599dcc', angle: -20 },
  BUBBLE: { art: 'bubble', motion: 'cast', tone: '#38a7bd', angle: 0 },
} as const satisfies Record<BrawlWeapon, { art: string; motion: string; tone: string; angle: number }>

export function brawlWeaponTier(level: number, maxLevel: number) {
  return Math.min(5, Math.floor(level * 5 / maxLevel))
}
