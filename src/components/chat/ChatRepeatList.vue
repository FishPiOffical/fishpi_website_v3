<script setup lang="ts" generic="T extends RepeatEntry">
import { computed, ref, watch, onMounted, onUpdated, onBeforeUnmount } from 'vue'
import { groupChatRepeats, type RepeatEntry } from '@/utils/chatRepeatGroups'
import { avatarThumbnail, fallbackAvatar } from '@/utils/avatar'
import ChatRepeatAction from './ChatRepeatAction.vue'
import { useChatPreferencesStore } from '@/stores/chatPreferences'
const props = defineProps<{ entries: T[]; reverse?: boolean; ownName?: string }>()
defineSlots<{ default(props: { entry: T }): unknown }>()
// 最多露出六张后层和一张完整前层，长复读仍可展开查看全部。
const visibleBackLayers = 6
const preferences = useChatPreferencesStore()
const mounted = ref(false)
const expanded = ref(new Set<string>())
const root = ref<HTMLElement | null>(null)
let observer: ResizeObserver | undefined
let frame = 0
// 叠层跟随实际气泡宽度，短消息和悬浮窄窗不会留下宽大的空卡片。
function measure() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    root.value?.querySelectorAll<HTMLElement>('.repeat-deck').forEach(deck => {
      const front = deck.querySelector<HTMLElement>('.repeat-front .message-stack') || deck.querySelector<HTMLElement>('.repeat-front')
      if (!front) return
      const bounds = deck.getBoundingClientRect()
      const step = bounds.width <= 520 ? 4 : 8
      deck.style.setProperty('--step', `${step}px`)
      const box = front.getBoundingClientRect()
      const offset = Number(deck.style.getPropertyValue('--layers')) * step
      const self = deck.parentElement?.classList.contains('repeat-group--self')
      deck.style.setProperty('--card-width', `${Math.min(box.width, bounds.width - 44)}px`)
      deck.style.setProperty('--card-left', `${box.left - bounds.left - (self ? 0 : offset)}px`)
      deck.style.setProperty('--card-right', `${bounds.right - box.right - (self ? offset : 0)}px`)
    })
  })
}
onMounted(() => { mounted.value = true; observer = new ResizeObserver(measure); if (root.value) observer.observe(root.value); measure() })
onUpdated(measure)
onBeforeUnmount(() => { observer?.disconnect(); cancelAnimationFrame(frame) })
const groups = computed(() => {
  const result = groupChatRepeats(props.entries)
  return props.reverse ? result.reverse() : result
})
// 清屏、撤回或换号后丢弃已不存在的组，避免保存旧会话展开状态。
watch(groups, value => {
  const keys = new Set(value.filter(group => group.length > 1).map(group => group[0]!.key))
  expanded.value = new Set([...expanded.value].filter(key => keys.has(key)))
})
function toggle(key: string) {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}
</script>
<template>
  <div ref="root" class="repeat-list">
  <div v-for="group in groups" :key="group[0]!.key" :data-repeat-messages="group.map(entry => entry.message?.oId).filter(Boolean).join(' ')" class="repeat-group" :class="{ 'repeat-group--self': group[group.length - 1]!.message?.userName === ownName }">
    <template v-if="group.length === 1"><slot :entry="group[0]!" /></template>
    <template v-else>
      <div v-if="!expanded.has(group[0]!.key)" class="repeat-deck" :style="{ '--layers': Math.min(group.length - 1, visibleBackLayers) }">
        <div v-for="(entry, index) in group.slice(Math.max(0, group.length - visibleBackLayers - 1), -1)" :key="entry.key" class="fp-msg is-room repeat-layer-shell" data-appearance-snapshot="v1" :data-bubble="mounted && preferences.simpleMode ? 'none' : entry.message?.appearance?.bubbleId" :style="{ '--layer': index }">
        <button class="fp-bubble repeat-layer" type="button" aria-label="展开复读消息" @click="toggle(group[0]!.key)">
          <img :src="avatarThumbnail(entry.message?.userAvatarURL, 20)" :alt="entry.message?.userNickname || entry.message?.userName" :data-user-card="entry.message?.userName" @error="fallbackAvatar" />
          <span>{{ entry.message?.userNickname || entry.message?.userName }}</span>
        </button>
        </div>
        <!-- 新复读覆盖在前层；组标识仍用最早消息，追加时不重置展开状态。 -->
        <div class="repeat-front"><slot :entry="group[group.length - 1]!" /></div>
      </div>
      <template v-else><template v-for="entry in (reverse ? [...group].reverse() : group)" :key="entry.key"><slot :entry="entry" /></template></template>
      <div class="repeat-controls">
        <button type="button" :aria-expanded="expanded.has(group[0]!.key)" @click="toggle(group[0]!.key)">{{ expanded.has(group[0]!.key) ? '收起' : '展开' }} · {{ group.length }} 条复读 <span aria-hidden="true">{{ expanded.has(group[0]!.key) ? '⌃' : '⌄' }}</span></button>
        <ChatRepeatAction :id="group[group.length - 1]!.message!.oId" label="+1" />
      </div>
    </template>
  </div>
  </div>
</template>
<style scoped>
.repeat-list { display: flex; flex-direction: column; gap: var(--repeat-gap, 12px); min-width: 0; flex-shrink: 0; }
.repeat-layer-shell { display: contents; }
/* 后层沿用消息的外观包底色，只隐藏装饰，避免多个角标挤在一起。 */
.repeat-layer-shell .repeat-layer::before, .repeat-layer-shell .repeat-layer::after { display: none !important; }
.repeat-group { min-width: 0; flex-shrink: 0; }
.repeat-deck { --step: 8px; --layer-height: 28px; position: relative; padding-top: calc(var(--layers) * var(--layer-height)); padding-right: calc(var(--layers) * var(--step)); isolation: isolate; }
.repeat-layer { position: absolute !important; top: calc(var(--layer) * var(--layer-height)); left: calc(var(--card-left, 44px) + var(--layer) * var(--step)); width: var(--card-width, min(220px, calc(100% - 76px))); height: 64px; display: flex; align-items: flex-start; gap: 6px; padding: 3px 10px !important; border: 1px solid var(--fp-border, #dfe3e8); border-radius: 12px; background: var(--fp-card, #fff); color: var(--fp-text-muted, #77808d); font: inherit; font-size: 11px; cursor: pointer; box-shadow: 0 2px 3px #00000006; animation: repeat-arrive .22s ease-out; }
.repeat-layer-shell:nth-child(even) .repeat-layer { background: color-mix(in srgb, var(--fp-primary, #65ae42) 5%, var(--fp-card, #fff)); }
/* 头像放在卡片外侧，每层独占一条头像行，不被下一层气泡盖住。 */
.repeat-layer img { position: absolute; left: -28px; top: 2px; width: 20px; height: 20px; object-fit: cover; border-radius: 4px; flex: none; }
.repeat-group--self .repeat-layer img { left: auto; right: -28px; }
.repeat-layer span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 20px; }
.repeat-front { position: relative; z-index: 2; transform: translateX(calc(var(--layers) * var(--step))); }
.repeat-controls { display: flex; align-items: center; gap: 14px; margin: 2px 0 14px 44px; color: var(--fp-text-muted, #77808d); font-size: 12px; }
.repeat-controls > button { border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; padding: 4px 0; }
.repeat-controls button:hover { color: var(--fp-primary); }
.repeat-group--self .repeat-deck { padding-right: 0; padding-left: calc(var(--layers) * var(--step)); }
.repeat-group--self .repeat-layer { left: auto; right: calc(var(--card-right, 44px) + var(--layer) * var(--step)); flex-direction: row-reverse; }
.repeat-group--self .repeat-front { transform: translateX(calc(-1 * var(--layers) * var(--step))); }
.repeat-group--self .repeat-controls { justify-content: flex-end; margin-left: 0; margin-right: 44px; }
@keyframes repeat-arrive { from { opacity: 0; translate: 0 -5px; } to { opacity: 1; translate: 0 0; } }
@media (max-width: 600px) { .repeat-deck { --step: 4px; } }
@media (prefers-reduced-motion: reduce) { .repeat-layer { animation: none; } }
</style>
