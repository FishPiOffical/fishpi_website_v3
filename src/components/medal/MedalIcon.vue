<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MetalItem } from '@/api/fishpi'
import V3MedalImage from './V3MedalImage.vue'

const props = withDefaults(
  defineProps<{
    medal: MetalItem
    owner?: boolean
    userName?: string
    /** 聊天室用的无文字小图 */
    mini?: boolean
    /** 悬停显示「[稀有度] 名称 - 描述」 */
    tooltip?: boolean
  }>(),
  { mini: false, tooltip: true },
)

const TYPE_CLASS: Record<string, string> = {
  精良: 'fine',
  稀有: 'rare',
  史诗: 'epic',
  传说: 'legend',
  神话: 'myth',
  限定: 'limited',
}

const tipPos = ref<{ left: number; top: number } | null>(null)

function showTip(e: MouseEvent) {
  if (!props.tooltip || !tipText.value) return
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  tipPos.value = { left: r.left + r.width / 2, top: r.top }
}

const typeClass = computed(() => TYPE_CLASS[props.medal.type || ''] || 'common')
const tipText = computed(() => {
  const m = props.medal
  return [m.name, m.description].filter(Boolean).join(' - ')
})
const label = computed(() => (props.medal.type ? `[${props.medal.type}] ${tipText.value}` : tipText.value))

</script>

<template>
  <span
    class="medal"
    :class="{ 'medal--mini': mini }"
    :aria-label="label"
    @mouseenter="showTip"
    @mouseleave="tipPos = null"
  >
    <V3MedalImage :id="medal.id || ''" :name="medal.name || ''" :owner="owner" :user-name="userName" :mini="mini" />
    <Teleport v-if="tipPos" to="body">
      <span class="medal-tip" role="tooltip" :style="{ left: `${tipPos.left}px`, top: `${tipPos.top}px` }">
        <span v-if="medal.type" class="medal-type" :class="`medal-type--${typeClass}`">[{{ medal.type }}]</span>
        {{ tipText }}
      </span>
    </Teleport>
  </span>
</template>

<style scoped lang="scss">
.medal {
  position: relative;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  cursor: default;
}
.medal-img {
  display: block;
  height: var(--medal-h, 28px);
  width: auto;
}
.medal--mini .medal-img,
.medal-fallback-icon {
  height: var(--medal-mini-h, 25px);
}
.medal-fallback-icon {
  width: var(--medal-mini-h, 25px);
  border-radius: 3px;
  object-fit: cover;
}
.medal-fallback {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: var(--medal-h, 28px);
  box-sizing: border-box;
  padding: 0 8px 0 3px;
  border: 1px solid var(--fp-border);
  border-radius: 4px;
  background: var(--fp-bg);
  color: var(--fp-text);
  font-size: 12px;
  white-space: nowrap;
}
.medal-fallback img {
  width: calc(var(--medal-h, 28px) - 8px);
  height: calc(var(--medal-h, 28px) - 8px);
  border-radius: 3px;
  object-fit: cover;
}

.medal-tip {
  position: fixed;
  z-index: 1500;
  width: max-content;
  max-width: 280px;
  padding: 6px 10px;
  border: 1px solid var(--fp-border);
  border-radius: 6px;
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow, 0 6px 18px rgba(0, 0, 0, 0.18));
  color: var(--fp-text);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
  text-align: center;
  white-space: normal;
  word-break: break-all;
  transform: translate(-50%, calc(-100% - 6px));
  pointer-events: none;
}

.medal-type--common {
  color: var(--fp-text);
}
.medal-type--fine {
  color: #1d4ed8;
}
.medal-type--rare {
  color: #8b5cf6;
}
.medal-type--epic {
  color: #ea580c;
  font-weight: 600;
}
.medal-type--legend {
  color: #eab308;
  font-weight: 700;
}
.medal-type--myth {
  color: #f59e0b;
  font-weight: 700;
  text-shadow: 0 0 3px rgba(245, 158, 11, 0.8);
}
.medal-type--limited {
  color: #ef4444;
  font-weight: 700;
  text-shadow: 0 0 6px rgba(239, 68, 68, 0.9);
}
html:not([data-theme='classic-light']) .medal-type--fine {
  color: #60a5fa;
}
</style>
