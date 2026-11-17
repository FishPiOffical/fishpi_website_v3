<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BrawlWeapon } from '@/api/v3-pets'
import PetIcon from './PetIcon.vue'

const props = withDefaults(defineProps<{
  weapon: BrawlWeapon
  level: number
  maxLevel?: number
  artifact?: boolean
  size?: 'small' | 'battle' | 'preview'
  pulse?: number
}>(), { maxLevel: 20, size: 'small' })

const trialArt = { SPOON: 'spoon', LEAF: 'leaf', BUBBLE: 'bubble' } as const
const art = computed(() => trialArt[props.weapon as keyof typeof trialArt])
const failedArt = ref<string>()
const source = computed(() => art.value && failedArt.value !== art.value
  ? `/images/pets/weapons/${art.value}.png` : undefined)
const tier = computed(() => Math.min(5, Math.floor(props.level * 5 / props.maxLevel)))
const fallback = computed(() => props.weapon === 'SPOON' ? 'feed' : props.weapon === 'GUARD' ? 'care' : 'outing')
</script>

<template>
  <span class="weapon-art" :data-art="art" :data-size="size" :data-tier="tier">
    <span class="weapon-art-face" aria-hidden="true">
      <span class="weapon-art-halo" />
      <img v-if="source" :key="source" :src="source" alt="" width="128" height="128" decoding="async" @error="failedArt = art">
      <PetIcon v-else :name="fallback" class="weapon-art-fallback" />
      <span v-if="tier >= 3" class="weapon-art-sparks" />
      <span v-if="pulse" :key="pulse" class="weapon-art-pulse" />
    </span>
    <span v-if="artifact" class="weapon-art-artifact">
      <PetIcon name="collection" aria-hidden="true" />
      <span class="sr-only">神器已进阶</span>
    </span>
  </span>
</template>

<style scoped>
.weapon-art {
  --weapon-size: 42px;
  --weapon-tone: var(--fp-primary);
  --weapon-glow: 0%;
  --weapon-rim: 0%;
  position: relative;
  display: inline-grid;
  place-items: center;
  flex: none;
  inline-size: var(--weapon-size);
  block-size: var(--weapon-size);
  border-radius: 9px;
  color: var(--fp-muted);
  background: color-mix(in srgb, var(--weapon-tone) var(--weapon-glow), var(--fp-bg));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--weapon-tone) var(--weapon-rim), transparent);
  vertical-align: middle;
}
.weapon-art[data-size='battle'] { --weapon-size: 36px; }
.weapon-art[data-size='preview'] { --weapon-size: 72px; border-radius: 12px; }
.weapon-art[data-art='spoon'] { --weapon-tone: #e2a03e; }
.weapon-art[data-art='leaf'] { --weapon-tone: #70ad54; }
.weapon-art[data-art='bubble'] { --weapon-tone: #38a7bd; }
.weapon-art[data-tier='1'] { --weapon-glow: 8%; --weapon-rim: 24%; }
.weapon-art[data-tier='2'] { --weapon-glow: 12%; --weapon-rim: 35%; }
.weapon-art[data-tier='3'] { --weapon-glow: 17%; --weapon-rim: 43%; }
.weapon-art[data-tier='4'] { --weapon-glow: 22%; --weapon-rim: 58%; }
.weapon-art[data-tier='5'] { --weapon-glow: 26%; --weapon-rim: 72%; }
.weapon-art-face { position: absolute; inset: 0; display: grid; place-items: center; isolation: isolate; }
.weapon-art-face img { position: relative; inline-size: 88%; block-size: 88%; object-fit: contain; }
:is([data-tier='2'], [data-tier='3'], [data-tier='4'], [data-tier='5']) .weapon-art-face img {
  filter: drop-shadow(0 0 2px color-mix(in srgb, var(--weapon-tone) 58%, transparent));
}
.weapon-art-fallback { position: relative; inline-size: 46%; block-size: 46%; }
.weapon-art-halo { position: absolute; inset: 16%; border-radius: 50%; }
:is([data-tier='4'], [data-tier='5']) .weapon-art-halo {
  border: 1px solid color-mix(in srgb, var(--weapon-tone) 65%, transparent);
  transform: rotate(-26deg) scaleY(.7);
}
[data-tier='5'] .weapon-art-halo { box-shadow: 0 0 7px color-mix(in srgb, var(--weapon-tone) 44%, transparent); }
.weapon-art-sparks {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(circle at 78% 20%, var(--weapon-tone) 0 1.2px, transparent 2px),
    radial-gradient(circle at 19% 72%, var(--weapon-tone) 0 .8px, transparent 1.6px);
  pointer-events: none;
}
.weapon-art-artifact {
  position: absolute;
  inset-inline-end: -3px;
  inset-block-end: -2px;
  display: grid;
  place-items: center;
  inline-size: 16px;
  block-size: 16px;
  border: 1px solid var(--fp-card);
  border-radius: 5px;
  background: #ffe4aa;
  color: #614210;
}
.weapon-art-artifact > svg { inline-size: 10px; block-size: 10px; }
.sr-only { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }
.weapon-art-pulse { display: none; }
@media (prefers-reduced-motion: no-preference) {
  .weapon-art-pulse {
    display: block;
    position: absolute;
    inset: 0;
    border: 2px solid var(--weapon-tone);
    border-radius: inherit;
    pointer-events: none;
    animation: weapon-strengthened .72s ease-out both;
  }
  @keyframes weapon-strengthened {
    from { opacity: .8; transform: scale(.85); }
    to { opacity: 0; transform: scale(1.23); }
  }
}
</style>
