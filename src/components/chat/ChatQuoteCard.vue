<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { RouterLink } from 'vue-router'
import ImageLightbox from '@/components/ImageLightbox.vue'
import { useFunctionPreferencesStore } from '@/stores/functionPreferences'
import { imageThumbnail, rhyPicThumbnail } from '@/utils/avatar'
import type { ChatQuote } from '@/utils/chatQuote'

const props = defineProps<{ quote: ChatQuote; standalone?: boolean }>()
const preferences = useFunctionPreferencesStore()
const zoomed = ref('')
const failed = ref(false)
const jumpLabel = computed(() => props.quote.kind === 'message' ? '查看原消息' : '查看清风明月')
const thumbnail = computed(() => props.quote.image ? imageThumbnail(props.quote.image, 40, 32) : '')
const hintText = computed(() => thumbnail.value ? '' : props.quote.fullText || '')
const displayText = computed(() => props.standalone
  ? hintText.value.replace(/\n{2,}/g, '\n') || props.quote.excerpt
  : props.quote.excerpt)
const hintId = useId()
const card = ref<HTMLElement | null>(null)
const excerpt = ref<HTMLElement | null>(null)
const hint = ref<HTMLElement | null>(null)
const hintPosition = ref<{ left: string; top?: string; bottom?: string; maxHeight: string } | null>(null)
let closeTimer: ReturnType<typeof setTimeout> | undefined

function closeHint() {
  clearTimeout(closeTimer)
  hintPosition.value = null
}

function showHint() {
  clearTimeout(closeTimer)
  if (hintPosition.value || !hintText.value || !card.value || !excerpt.value) return
  const clipped = props.standalone
    ? excerpt.value.scrollHeight > excerpt.value.clientHeight
    : excerpt.value.scrollWidth > excerpt.value.clientWidth || hintText.value.includes('\n') || hintText.value !== props.quote.excerpt
  if (!clipped) return
  const rect = card.value.getBoundingClientRect()
  const gutter = 8
  const width = Math.min(360, window.innerWidth - gutter * 2)
  const above = rect.top > window.innerHeight - rect.bottom
  hintPosition.value = {
    left: `${Math.max(gutter, Math.min(rect.left, window.innerWidth - width - gutter))}px`,
    ...(above ? { bottom: `${window.innerHeight - rect.top + 3}px` } : { top: `${rect.bottom + 3}px` }),
    maxHeight: `${Math.min(280, (above ? rect.top : window.innerHeight - rect.bottom) - gutter - 3)}px`,
  }
}

function onPointerEnter(event: PointerEvent) {
  if (event.pointerType !== 'touch') showHint()
}

function scheduleClose() {
  clearTimeout(closeTimer)
  if (!hintPosition.value) return
  closeTimer = setTimeout(() => {
    if (!card.value?.matches(':hover') && !card.value?.querySelector('.chat-quote-jump:focus-visible')
      && !hint.value?.matches(':hover')) closeHint()
  }, 150)
}

watch(hintPosition, (position, _, onCleanup) => {
  if (!position) return
  const dismissOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') closeHint()
  }
  const dismissOnScroll = (event: Event) => {
    if (event.target !== hint.value) closeHint()
  }
  window.addEventListener('keydown', dismissOnEscape)
  window.addEventListener('scroll', dismissOnScroll, true)
  window.addEventListener('resize', closeHint)
  onCleanup(() => {
    window.removeEventListener('keydown', dismissOnEscape)
    window.removeEventListener('scroll', dismissOnScroll, true)
    window.removeEventListener('resize', closeHint)
  })
})
watch(() => [props.quote.href, hintText.value], closeHint)
onBeforeUnmount(closeHint)

watch(() => props.quote.image, () => {
  failed.value = false
  zoomed.value = ''
})

function openImage() {
  const image = props.quote.image
  if (image) zoomed.value = failed.value ? image : rhyPicThumbnail(image, 1024, 1024)
}
</script>

<template>
  <div ref="card" class="chat-quote-card" :class="{ 'chat-quote-card--standalone': standalone }" @pointerenter="onPointerEnter" @pointerleave="scheduleClose">
    <span class="chat-quote-source">
      <svg v-if="standalone" class="chat-quote-mark" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M6.9 3.1C4.5 3.9 3 5.8 3 8.8h3.6V13H2V9c0-3.6 1.7-6 4.3-7l.6 1.1Zm7 0C11.5 3.9 10 5.8 10 8.8h3.6V13H9V9c0-3.6 1.7-6 4.3-7l.6 1.1Z" />
      </svg>
      <span class="chat-quote-author">{{ quote.author || (quote.kind === 'message' ? '引用消息' : '清风明月') }}</span><span v-if="!standalone">：</span>
    </span>
    <button v-if="thumbnail" class="chat-quote-image" :class="{ 'chat-quote-image--fallback': failed }" type="button" aria-label="查看引用大图" @click="openImage">
      <img v-if="!failed" :src="thumbnail" :class="{ blurred: preferences.blurChatImages }" alt="" loading="lazy" @error="failed = true" />
      <span v-else>图片</span>
    </button>
    <span v-else ref="excerpt" class="chat-quote-excerpt">{{ displayText }}</span>
    <component
      :is="quote.kind === 'message' ? RouterLink : 'a'"
      v-bind="quote.kind === 'message'
        ? { to: quote.href }
        : { href: quote.href, target: '_blank', rel: 'noopener noreferrer' }"
      class="chat-quote-jump"
      :aria-label="jumpLabel"
      :aria-describedby="hintPosition ? hintId : undefined"
      :title="jumpLabel"
      @focus="showHint"
      @blur="scheduleClose"
      @click="closeHint"
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m5 11 6-6M6 5h5v5" />
      </svg>
    </component>
    <ImageLightbox v-if="quote.image" v-model="zoomed" :original-src="quote.image" />
    <Teleport v-if="hintPosition" to="body">
      <div :id="hintId" ref="hint" class="chat-quote-hint" role="tooltip" :style="hintPosition"
        @pointerenter="onPointerEnter" @pointerleave="scheduleClose">{{ hintText }}</div>
    </Teleport>
  </div>
</template>

<style scoped>
.chat-quote-card {
  display: flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  max-width: min(240px, 100%);
  min-width: 0;
  box-sizing: border-box;
  padding: 3px 7px;
  border: 0;
  border-inline-start: 2px solid color-mix(in srgb, var(--fp-muted) 35%, transparent);
  border-radius: 0 4px 4px 0;
  background: transparent;
  color: var(--fp-muted);
  text-align: start;
  text-decoration: none;
  font-size: 12px;
  line-height: 18px;
}
.chat-quote-card :is(.chat-quote-jump, .chat-quote-image):focus-visible {
  outline: 2px solid var(--fp-link);
  outline-offset: 2px;
}
.chat-quote-source {
  display: flex;
  align-items: center;
  flex: 0 1 auto;
  max-width: 80px;
  min-width: 0;
  color: var(--fp-muted);
  white-space: nowrap;
}
.chat-quote-author { overflow: hidden; text-overflow: ellipsis; }
.chat-quote-jump {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 24px;
  height: 24px;
  margin-block: -3px;
  border-radius: 4px;
  color: inherit;
  text-decoration: none;
}
.chat-quote-jump:hover { color: var(--fp-title); background: var(--fp-hover); text-decoration: none; }
.chat-quote-jump svg { width: 14px; height: 14px; }
.chat-quote-image {
  display: block;
  flex: none;
  width: 40px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  overflow: hidden;
  background: var(--fp-hover);
  cursor: zoom-in;
}
.chat-quote-image img { display: block; width: 100%; height: 100%; object-fit: contain; }
.chat-quote-image img.blurred { filter: blur(8px); }
.chat-quote-image--fallback { color: inherit; font: inherit; }
.chat-quote-excerpt {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: inherit;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.chat-quote-card--standalone {
  display: grid;
  grid-template-areas: "source jump" "excerpt excerpt";
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 12px;
  max-width: min(20rem, 100%);
  padding: 6px 8px 9px 11px;
  border: 1px solid var(--fp-border);
  border-inline-start: 2px solid color-mix(in srgb, var(--fp-primary) 56%, var(--fp-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--fp-hover) 65%, var(--fp-card));
}
.chat-quote-card--standalone .chat-quote-source {
  grid-area: source;
  gap: 5px;
  max-width: none;
  font-weight: 600;
}
.chat-quote-mark {
  flex: none;
  width: 13px;
  height: 13px;
  color: var(--fp-primary-ink, var(--fp-muted));
}
.chat-quote-card--standalone .chat-quote-jump {
  grid-area: jump;
  margin-block: 0;
}
.chat-quote-card--standalone :is(.chat-quote-excerpt, .chat-quote-image) { grid-area: excerpt; }
.chat-quote-card--standalone .chat-quote-excerpt {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  color: var(--fp-text);
  font-size: 0.8125rem;
  line-height: 1.5;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
@media (pointer: coarse) {
  .chat-quote-card--standalone :is(.chat-quote-jump, .chat-quote-image) {
    min-inline-size: 44px;
    min-block-size: 44px;
  }
}
.chat-quote-hint {
  position: fixed;
  z-index: 2000;
  box-sizing: border-box;
  width: min(360px, calc(100vw - 16px));
  overflow: auto;
  overscroll-behavior: contain;
  padding: 8px 10px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-card);
  box-shadow: var(--fp-float-shadow, 0 6px 18px #0002);
  color: var(--fp-text);
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
