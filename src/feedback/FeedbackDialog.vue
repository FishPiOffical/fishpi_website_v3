<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import FpDialog from '@/components/FpDialog.vue'
import FeedbackView from './FeedbackView.vue'
import { useFeedbackPanelStore } from './panel'

const panel = useFeedbackPanelStore()
const content = ref<HTMLElement | null>(null)
let previous: HTMLElement | null = null
let previousOverflow = ''

function onKey(event: KeyboardEvent) {
  if (event.key !== 'Tab' || document.querySelector('.fp-dialog-mask.layer-top:not(.fp-dialog-leave-active)')) return
  const dialog = content.value?.closest<HTMLElement>('[role="dialog"]')
  const nodes = Array.from(dialog?.querySelectorAll<HTMLElement>('a[href],button:enabled,input:enabled,select:enabled,textarea:enabled,[tabindex="0"]') ?? [])
    .filter(node => node.getClientRects().length)
  const first = nodes[0]
  const last = nodes.at(-1)
  if (!first) { event.preventDefault(); content.value?.focus(); return }
  const active = document.activeElement
  if (!dialog?.contains(active) || active === content.value || (event.shiftKey ? active === first : active === last)) {
    event.preventDefault()
    const next = event.shiftKey ? last : first
    next?.focus()
  }
}

onMounted(() => {
  previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKey, true)
})
watch(content, element => element?.focus(), { flush: 'post' })
watch(() => panel.location.path, async () => {
  await nextTick()
  if (!content.value?.closest('[role="dialog"]')?.contains(document.activeElement)) content.value?.focus()
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKey, true)
  document.body.style.overflow = previousOverflow
  // 从设置抽屉打开时，原按钮会随抽屉关闭而卸载。
  const trigger = previous?.isConnected && previous !== document.body &&
    !previous.closest('.fp-set-panel') && previous.getClientRects().length ? previous
    : document.querySelector<HTMLElement>('[aria-label="打开设置"]')
  trigger?.focus()
})
</script>

<template>
  <FpDialog :open="panel.open" title="需求反馈" :width="880" flush @close="panel.hide">
    <div ref="content" class="feedback-dialog-content" tabindex="-1">
      <FeedbackView embedded />
    </div>
  </FpDialog>
</template>

<style scoped>
.feedback-dialog-content { outline: none; }
.feedback-dialog-content :deep(.feedback) {
  width: auto;
  max-width: none;
  margin: 0;
  padding: 0;
}
.feedback-dialog-content :deep(.feedback-head) {
  position: sticky;
  top: 0;
  z-index: 5;
  margin: 0;
  padding: 8px var(--dialog-inset);
  background: var(--fp-card);
  border-bottom: 1px solid var(--fp-border);
}
.feedback-dialog-content :deep(.head-brand) { display: none; }
.feedback-dialog-content :deep(.head-actions) { margin-inline-start: auto; }
.feedback-dialog-content :deep(.feedback-body) { padding: 16px var(--dialog-inset); }
</style>
