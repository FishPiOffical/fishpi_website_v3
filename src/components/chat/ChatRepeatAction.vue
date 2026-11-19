<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useV3ChatPublicationStore } from '@/stores/v3ChatPublication'

const props = defineProps<{ content?: string; label?: string; compact?: boolean }>()
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
  <span v-if="mounted && auth.accessToken && auth.account?.oId && content?.trim()" class="chat-repeat" :class="{ 'chat-repeat--compact': compact }">
    <button type="button" title="复读这条消息" aria-label="复读这条消息" :disabled="sending || publication.busy || !!publication.pending" :aria-busy="sending" @click="repeat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/></svg><span>{{ sending ? '…' : (label || '复读') }}</span></button>
  </span>
</template>
<style scoped>
.chat-repeat{display:inline-flex;align-items:center;gap:6px;max-width:100%}.chat-repeat button{display:inline-flex;align-items:center;gap:3px;font:inherit;color:inherit;background:transparent;border:0;padding:2px 0;cursor:pointer}.chat-repeat svg{width:13px;height:13px;flex:none}.chat-repeat button:disabled{opacity:.45;cursor:default}.chat-repeat button:focus-visible{outline:2px solid var(--fp-primary);outline-offset:2px}
/* 折叠组的 +1 保持独立触点，其他消息操作仍用原来的轻量文本样式。 */
.chat-repeat--compact button { min-width: 56px; min-height: 30px; justify-content: center; gap: 6px; padding: 4px 10px; border: 1px solid var(--fp-border); border-radius: 8px; background: var(--fp-hover); color: var(--fp-text); font-weight: 600; transition: background .15s, border-color .15s; }
.chat-repeat--compact button:hover:not(:disabled) { border-color: var(--fp-primary); color: var(--fp-primary); }
.chat-repeat--compact button:active:not(:disabled) { background: var(--fp-border); }
.chat-repeat--compact svg { width: 14px; height: 14px; }
</style>
