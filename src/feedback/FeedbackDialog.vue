<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import FeedbackView from './FeedbackView.vue'
import { useFeedbackPanelStore } from './panel'
const panel=useFeedbackPanelStore(), dialog=ref<HTMLElement|null>(null)
let previous:HTMLElement|null=null, overflow=''
function onKey(e:KeyboardEvent) {
  if(e.key==='Escape') {e.preventDefault();e.stopPropagation();panel.hide()}
  if(e.key!=='Tab') return
  const nodes=Array.from(dialog.value?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]') || []).filter(n=>n.getClientRects().length>0)
  const first=nodes[0],last=nodes.at(-1)
  if(!first) {e.preventDefault();dialog.value?.focus();return}
  if(!dialog.value?.contains(document.activeElement)) {e.preventDefault();first.focus()}
  else if(e.shiftKey && (document.activeElement===first || document.activeElement===dialog.value)) {e.preventDefault();last?.focus()}
  else if(!e.shiftKey && document.activeElement===last) {e.preventDefault();first.focus()}
}
onMounted(()=>{previous=document.activeElement instanceof HTMLElement?document.activeElement:null;overflow=document.body.style.overflow;document.body.style.overflow='hidden';document.addEventListener('keydown',onKey,true);dialog.value?.focus()})
watch(()=>panel.location.path,async()=>{await nextTick();if(!dialog.value?.contains(document.activeElement)) dialog.value?.focus()})
onUnmounted(()=>{document.removeEventListener('keydown',onKey,true);document.body.style.overflow=overflow;if(previous?.isConnected && previous!==document.body) previous.focus();else document.querySelector<HTMLElement>('[aria-label="打开设置"]')?.focus()})
</script>
<template>
  <div class="feedback-backdrop" @click.self="panel.hide()">
    <section ref="dialog" class="feedback-dialog" role="dialog" aria-modal="true" aria-label="需求反馈" tabindex="-1">
      <button class="dialog-close" type="button" aria-label="关闭需求反馈" title="关闭 (Esc)" @click="panel.hide()">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <div class="feedback-dialog-scroll">
        <FeedbackView embedded />
      </div>
    </section>
  </div>
</template>
<style scoped>
.feedback-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1600;
  display: grid;
  place-items: center;
  padding: 20px;
  background: var(--fp-mask-bg, rgba(0, 0, 0, 0.55));
  backdrop-filter: blur(6px);
}

.feedback-dialog {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(100%, 880px);
  max-height: min(88dvh, 820px);
  overflow: hidden;
  background: var(--fp-card, var(--fp-bg));
  border: 1px solid var(--fp-border-strong, var(--fp-border));
  border-radius: 16px;
  box-shadow: var(--fp-dialog-shadow, 0 24px 64px rgba(0, 0, 0, 0.45));
  outline: none;
  animation: feedback-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.feedback-dialog-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.dialog-close {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-elevated, var(--fp-bg));
  color: var(--fp-muted);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.dialog-close:hover {
  background: var(--fp-hover);
  border-color: var(--fp-border-strong);
  color: var(--fp-title);
}

.dialog-close:focus-visible {
  outline: 2px solid var(--fp-primary);
  outline-offset: 2px;
}

.feedback-dialog :deep(.feedback) {
  width: auto;
  max-width: none;
  margin: 0;
  padding: 0;
}

.feedback-dialog :deep(.feedback-head) {
  position: sticky;
  top: 0;
  z-index: 5;
  margin: 0;
  padding: 18px 62px 16px 24px;
  background: color-mix(in srgb, var(--fp-card, var(--fp-bg)) 92%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--fp-border);
}

.feedback-dialog :deep(.feedback-body) {
  padding: 20px 24px 24px;
}

@keyframes feedback-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 640px) {
  .feedback-backdrop {
    padding: 10px;
  }
  .feedback-dialog {
    max-height: 94dvh;
    border-radius: 14px;
  }
  .dialog-close {
    top: 14px;
    right: 14px;
  }
  .feedback-dialog :deep(.feedback-head) {
    padding: 14px 54px 14px 16px;
  }
  .feedback-dialog :deep(.feedback-body) {
    padding: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .feedback-dialog {
    animation: none;
  }
}
</style>
