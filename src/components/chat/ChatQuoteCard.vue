<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import ImageLightbox from '@/components/ImageLightbox.vue'
import { useFunctionPreferencesStore } from '@/stores/functionPreferences'
import { imageThumbnail, rhyPicThumbnail } from '@/utils/avatar'
import type { ChatQuote } from '@/utils/chatQuote'

const props = defineProps<{ quote: ChatQuote }>()
const preferences = useFunctionPreferencesStore()
const zoomed = ref('')
const failed = ref(false)
const jumpLabel = computed(() => props.quote.kind === 'message' ? '查看原消息' : '查看清风明月')
const thumbnail = computed(() => props.quote.image ? imageThumbnail(props.quote.image, 40, 32) : '')
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
  <div class="chat-quote-card">
    <span class="chat-quote-source">
      <span class="chat-quote-author">{{ quote.author || (quote.kind === 'message' ? '引用消息' : '清风明月') }}</span><span>：</span>
    </span>
    <button v-if="thumbnail" class="chat-quote-image" :class="{ 'chat-quote-image--fallback': failed }" type="button" aria-label="查看引用大图" @click="openImage">
      <img v-if="!failed" :src="thumbnail" :class="{ blurred: preferences.blurChatImages }" alt="" loading="lazy" @error="failed = true" />
      <span v-else>图片</span>
    </button>
    <span v-else class="chat-quote-excerpt" :title="quote.excerpt">{{ quote.excerpt }}</span>
    <component
      :is="quote.kind === 'message' ? RouterLink : 'a'"
      v-bind="quote.kind === 'message'
        ? { to: quote.href }
        : { href: quote.href, target: '_blank', rel: 'noopener noreferrer' }"
      class="chat-quote-jump"
      :aria-label="jumpLabel"
      :title="jumpLabel"
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m5 11 6-6M6 5h5v5" />
      </svg>
    </component>
    <ImageLightbox v-if="quote.image" v-model="zoomed" :original-src="quote.image" />
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
</style>
