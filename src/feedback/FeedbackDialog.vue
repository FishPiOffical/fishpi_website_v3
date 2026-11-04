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
      <button class="dialog-close" type="button" aria-label="关闭需求反馈" @click="panel.hide()">×</button>
      <FeedbackView embedded />
    </section>
  </div>
</template>
<style scoped>
.feedback-backdrop{position:fixed;inset:0;z-index:1600;display:grid;place-items:center;padding:24px;background:rgb(0 0 0 / .35);backdrop-filter:blur(3px)}.feedback-dialog{position:relative;width:min(100%,1000px);max-height:90dvh;overflow:auto;overscroll-behavior:contain;background:var(--fp-bg);border:1px solid var(--fp-border);border-radius:18px;box-shadow:0 18px 70px #0003;outline:none;animation:feedback-in .18s ease-out}.dialog-close{position:sticky;top:12px;float:right;margin:12px 14px 0 0;z-index:1;width:34px;height:34px;border:0;border-radius:50%;background:var(--fp-card);color:var(--fp-muted);font-size:26px;cursor:pointer}.dialog-close:hover{background:var(--fp-hover);color:var(--fp-text)}.feedback-dialog :deep(.feedback){margin-top:28px;padding-bottom:24px}.feedback-dialog :deep(.feedback-head){padding-right:30px}@keyframes feedback-in{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:none}}@media(max-width:600px){.feedback-backdrop{padding:10px}.feedback-dialog{max-height:95dvh;border-radius:12px}}@media(prefers-reduced-motion:reduce){.feedback-dialog{animation:none}}
</style>
