<script setup lang="ts">
import { computed } from 'vue'
import type { BrawlWeapon } from '@/api/v3-pets'
import { petBattlePoster, type PetBattleAction } from './animations'
import PetAnimation from './PetAnimation.vue'
import PetBrawlWeaponArt from './PetBrawlWeaponArt.vue'
import { brawlWeaponTier, brawlWeaponVisuals } from './brawlWeaponArt'

const props = defineProps<{
  species: string
  action?: PetBattleAction
  weapon: BrawlWeapon
  level: number
  maxLevel: number
  artifact: boolean
  turnKey: string
  duration: number
  playing: boolean
  still: boolean
  mirrored?: boolean
}>()

const visual = computed(() => brawlWeaponVisuals[props.weapon])
const tier = computed(() => brawlWeaponTier(props.level, props.maxLevel))
const isTurn = computed(() => props.action === 'attack' || props.action === 'hit')
</script>

<template>
  <div class="fighter-visual" :class="{ mirrored }" aria-hidden="true">
    <div v-if="isTurn" :key="turnKey" class="turn-visual" :class="{ still }" :data-action="action"
      :data-weapon="weapon" :data-motion="visual.motion" :data-tier="tier" :data-artifact="artifact"
      :style="{ '--turn-duration': `${duration}ms`, '--turn-play-state': playing ? 'running' : 'paused',
        '--effect-tone': visual.tone, '--held-angle': `${visual.angle}deg`, '--effect-scale': 1 + tier * .045 }">
      <img class="fighter-sprite" :src="petBattlePoster(species)" alt="" width="160" height="160" draggable="false" />
      <template v-if="action === 'attack'">
        <span class="held-weapon">
          <PetBrawlWeaponArt :weapon="weapon" :level="level" :max-level="maxLevel" size="action" />
        </span>
        <span class="attack-trail" />
      </template>
      <span v-else class="hit-mark" />
    </div>
    <PetAnimation v-else-if="!still && action" :species="species" alt="" :battle-action="action"
      :playback-key="turnKey" :active="playing" :loop="false" hold-frame :width="160" :height="160" />
    <img v-else class="fighter-sprite" :src="petBattlePoster(species)" alt="" width="160" height="160" draggable="false" />
  </div>
</template>

<style scoped>
.fighter-visual { position: relative; inline-size: 160px; max-inline-size: 100%; aspect-ratio: 1; pointer-events: none; }
.fighter-visual.mirrored { transform: scaleX(-1); }
.turn-visual { position: absolute; inset: 0; }
.fighter-sprite { display: block; inline-size: 100%; block-size: 100%; object-fit: contain; transform-origin: 50% 82%; }
.held-weapon {
  position: absolute;
  inset: 43% auto auto 54%;
  inline-size: 44%;
  aspect-ratio: 1;
  transform: rotate(var(--held-angle));
  transform-origin: 23% 66%;
  filter: drop-shadow(0 2px 2px #0004);
}
[data-motion='bash'] .held-weapon { inset: 47% auto auto 56%; inline-size: 39%; }
:is([data-motion='cast'], [data-motion='throw']) .held-weapon { inset: 38% auto auto 57%; inline-size: 40%; }
[data-weapon='PEBBLE'] .held-weapon { inline-size: 32%; inset-block-start: 45%; }
:is([data-tier='3'], [data-tier='4'], [data-tier='5'], [data-artifact='true']) .held-weapon {
  filter: drop-shadow(0 0 5px var(--effect-tone));
}
.attack-trail, .hit-mark { position: absolute; opacity: 0; color: var(--effect-tone); }
.attack-trail {
  inset: 38% auto auto 60%;
  inline-size: 45%;
  aspect-ratio: 1;
  border: 0 solid transparent;
  border-inline-end: 3px solid currentColor;
  border-radius: 50%;
}
[data-motion='bash'] .attack-trail { border: 2px solid currentColor; border-radius: 30%; }
:is([data-motion='cast'], [data-motion='throw']) .attack-trail { border: 2px solid currentColor; inline-size: 30%; }
.hit-mark {
  inset: 38% auto auto 63%;
  inline-size: 34%;
  aspect-ratio: 1;
  background: currentColor;
  clip-path: polygon(50% 0, 61% 35%, 91% 12%, 73% 43%, 100% 50%, 71% 63%, 88% 90%, 59% 75%, 50% 100%, 37% 71%, 12% 88%, 28% 59%, 0 50%, 31% 39%, 12% 12%, 42% 31%);
}
[data-motion='cast'] .hit-mark { clip-path: none; background: none; border: 3px solid currentColor; border-radius: 50%; }
[data-artifact='true'] .hit-mark { inline-size: 42%; }
.still .hit-mark { opacity: .4; transform: scale(.8); }

@media (prefers-reduced-motion: no-preference) {
  .turn-visual:not(.still) :is(.fighter-sprite, .held-weapon, .attack-trail, .hit-mark) {
    animation-duration: var(--turn-duration);
    animation-play-state: var(--turn-play-state);
    animation-fill-mode: both;
  }
  .turn-visual:not(.still)[data-action='attack'] .fighter-sprite { animation-name: windup-and-lunge; }
  .turn-visual:not(.still):is([data-motion='cast'], [data-motion='throw'])[data-action='attack'] .fighter-sprite { animation-name: windup-and-cast; }
  .turn-visual:not(.still)[data-action='hit'] .fighter-sprite { animation-name: recoil; }
  .turn-visual:not(.still) .held-weapon { animation-name: swing; }
  .turn-visual:not(.still)[data-motion='bash'] .held-weapon { animation-name: bash; }
  .turn-visual:not(.still):is([data-motion='cast'], [data-motion='throw']) .held-weapon { animation-name: cast-tool; }
  .turn-visual:not(.still)[data-weapon='PEBBLE'] .held-weapon { animation-name: release-stone; }
  .turn-visual:not(.still) .attack-trail { animation-name: follow-through; }
  .turn-visual:not(.still) .hit-mark { animation-name: contact; }
}
@media (prefers-reduced-motion: reduce) {
  .hit-mark { opacity: .4; transform: scale(.8); }
}

@keyframes windup-and-lunge {
  0%, 100% { transform: none; }
  20% { transform: translateX(-6%) rotate(-8deg) scaleY(.92); }
  44% { transform: translate(18%, -5%) rotate(10deg); }
  65% { transform: translateX(8%) rotate(4deg); }
}
@keyframes windup-and-cast {
  0%, 100% { transform: none; }
  21% { transform: translateX(-5%) rotate(-8deg) scaleY(.95); }
  37% { transform: translate(7%, -3%) rotate(6deg); }
}
@keyframes swing {
  0% { opacity: .9; }
  20% { transform: translate(-19%, -15%) rotate(calc(var(--held-angle) - 48deg)); }
  44% { transform: translate(40%, -10%) rotate(calc(var(--held-angle) + 58deg)) scale(var(--effect-scale)); }
  66% { opacity: 1; transform: translate(22%, 6%) rotate(calc(var(--held-angle) + 36deg)); }
  100% { opacity: .85; transform: rotate(var(--held-angle)); }
}
@keyframes bash {
  0%, 100% { transform: rotate(var(--held-angle)); }
  20% { transform: translate(-10%, 5%) rotate(-15deg); }
  44% { transform: translate(41%, -5%) rotate(10deg) scale(var(--effect-scale)); }
  66% { transform: translateX(14%); }
}
@keyframes cast-tool {
  0%, 100% { transform: rotate(var(--held-angle)); }
  21% { transform: translate(-18%, -17%) rotate(calc(var(--held-angle) - 30deg)); }
  36% { transform: translate(19%, -9%) rotate(calc(var(--held-angle) + 18deg)); }
  58% { transform: translate(8%, -2%) rotate(var(--held-angle)); }
}
@keyframes release-stone {
  0%, 100% { opacity: 1; transform: rotate(var(--held-angle)); }
  21% { opacity: 1; transform: translate(-18%, -17%) rotate(calc(var(--held-angle) - 30deg)); }
  36% { opacity: 1; transform: translate(19%, -9%) rotate(calc(var(--held-angle) + 18deg)); }
  46%, 72% { opacity: 0; transform: translate(45%, -15%) scale(.8); }
}
@keyframes follow-through {
  30%, 74% { opacity: 0; }
  45% { opacity: .8; transform: translateX(18%) rotate(-24deg) scale(var(--effect-scale)); }
}
@keyframes recoil {
  0%, 47%, 100% { transform: none; }
  57% { transform: translateX(-13%) rotate(-9deg) scaleY(.9); }
  72% { transform: translateX(-5%) rotate(4deg); }
}
@keyframes contact {
  0%, 47% { opacity: 0; transform: scale(.45); }
  56% { opacity: .85; transform: scale(var(--effect-scale)); }
  80%, 100% { opacity: 0; transform: scale(1.42); }
}
</style>
