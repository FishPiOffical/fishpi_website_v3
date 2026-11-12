<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null
let previousOverflow = ''
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close') }
  if (event.key !== 'Tab') return
  const nodes = Array.from(panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[contenteditable="true"],[tabindex="0"]') || []).filter(el => el.getClientRects().length)
  const first = nodes[0], last = nodes.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
function release() {
  document.removeEventListener('keydown', keydown)
  document.body.style.overflow = previousOverflow
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
}
watch(() => props.open, async open => {
  if (open) {
    previousFocus = document.activeElement as HTMLElement | null
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', keydown)
    await nextTick()
    if (props.open) panel.value?.querySelector<HTMLButtonElement>('.quick-reply-close')?.focus()
  } else release()
})
onBeforeUnmount(() => { if (props.open) release() })
</script>
<template>
  <!-- 只移动同一份编辑器 DOM，关闭弹窗不销毁草稿或待确认操作。 -->
  <Teleport to="body" :disabled="!open">
    <div :class="{ 'quick-reply-mask': open }">
      <section ref="panel" :class="{ 'quick-reply-panel': open }" :role="open ? 'dialog' : undefined" :aria-modal="open ? true : undefined" :aria-label="open ? '写回复' : undefined">
        <header v-if="open" class="quick-reply-heading"><strong>写回复</strong><button class="quick-reply-close" type="button" aria-label="关闭回复窗口，保留草稿" @click="emit('close')">×</button></header>
        <slot />
      </section>
    </div>
  </Teleport>
</template>
<style scoped>
.quick-reply-mask { position: fixed; inset: 0; z-index: 1350; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgb(0 0 0 / 32%); }
.quick-reply-panel { width: min(720px, 100%); max-height: calc(100dvh - 40px); overflow: auto; overscroll-behavior: contain; padding: 20px; box-sizing: border-box; border: 1px solid var(--fp-border); border-radius: 16px; background: var(--fp-card); color: var(--fp-text); box-shadow: 0 16px 60px rgb(0 0 0 / 18%); }
.quick-reply-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.quick-reply-close { border: 0; background: transparent; color: var(--fp-muted); font-size: 26px; cursor: pointer; width: 36px; height: 36px; }
@media (max-width: 640px) { .quick-reply-mask { padding: 0; align-items: flex-end; } .quick-reply-panel { max-height: 90dvh; border-radius: 16px 16px 0 0; padding: 16px 16px max(16px, env(safe-area-inset-bottom)); } }
</style>
