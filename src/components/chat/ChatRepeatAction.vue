<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useV3ChatPublicationStore } from '@/stores/v3ChatPublication'

const props = defineProps<{ content?: string }>()
const auth = useAuthStore()
const publication = useV3ChatPublicationStore()
const mounted = ref(false)
const sending = ref(false)

async function repeat() {
  const content = props.content
  if (!mounted.value || !auth.accessToken || !auth.account?.oId || !content?.trim() || sending.value || publication.busy || publication.pending) return
  sending.value = true
  try {
    await publication.send(content, 'repeat')
  } finally {
    sending.value = false
  }
}
onMounted(() => { mounted.value = true })
</script>
<template>
  <button v-if="mounted && auth.accessToken && auth.account?.oId && content?.trim()" type="button"
    class="chat-repeat" title="复读这条消息" aria-label="复读这条消息"
    :disabled="sending || publication.busy || !!publication.pending" :aria-busy="sending" @click="repeat">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 10a7 7 0 0 1 12-3l2 2m0-4v4h-4M19 14a7 7 0 0 1-12 3l-2-2m0 4v-4h4" />
    </svg>
  </button>
</template>
<style scoped>
.chat-repeat {
  display: grid;
  place-items: center;
  min-inline-size: 26px;
  min-block-size: 26px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--fp-muted);
  cursor: pointer;
}
.chat-repeat svg { width: 16px; height: 16px; }
.chat-repeat:disabled { opacity: .5; cursor: default; }
.chat-repeat:focus-visible { outline: 2px solid var(--fp-link); outline-offset: 2px; }
.chat-repeat:enabled:is(:focus-visible, :active) {
  background: var(--fp-hover);
  color: var(--fp-title, var(--fp-text));
}
@media (hover: hover) and (pointer: fine) {
  .chat-repeat:enabled:hover {
    background: var(--fp-primary-soft, var(--fp-hover));
    color: var(--fp-primary-ink, var(--fp-title, var(--fp-text)));
  }
  .chat-repeat:enabled:active { background: var(--fp-border); }
}
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .chat-repeat:enabled:hover svg { animation: repeat-turn 260ms ease-out; }
}
@media (pointer: coarse) {
  .chat-repeat { min-inline-size: 44px; min-block-size: 44px; }
}
@keyframes repeat-turn {
  0%, 100% { transform: rotate(0); }
  48% { transform: rotate(24deg) scale(1.12); }
}
</style>
