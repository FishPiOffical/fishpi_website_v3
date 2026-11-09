<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import FpDialog from '@/components/FpDialog.vue'
import { activeDialogState } from '@/composables/useDialog'
import ChatRedPacketEditor from './ChatRedPacketEditor.vue'
import ChatBarrageEditor from './ChatBarrageEditor.vue'
import PaintPanel from './PaintPanel.vue'
const props = defineProps<{tool:''|'packet'|'barrage'|'paint'}>()
const emit = defineEmits<{close:[];insert:[md:string]}>()
const content = ref<HTMLElement|null>(null)
const info = computed(() => ({packet:{title:'发红包',hint:'一点心意，和大家分享摸鱼的快乐。'},barrage:{title:'发送弹幕',hint:'让你的话，从屏幕的另一端飘过。'},paint:{title:'涂鸦画板',hint:'画好后插入输入框，编辑完成再发送。'}})[props.tool || 'packet'])
let trigger:HTMLElement|null=null, confirmFocus:HTMLElement|null=null, previousOverflow:string|null=null, sequence=0, disposed=false
function dialog() { return activeDialogState.value ? document.querySelector<HTMLElement>('.fp-dialog-mask.layer-top [role=dialog]') : content.value?.closest<HTMLElement>('[role=dialog]') }
function focusables() { return Array.from(dialog()?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') || []).filter(node=>node.getClientRects().length) }
function trap(event:KeyboardEvent) {
  if(event.key!=='Tab')return
  const nodes=focusables(),first=nodes[0],last=nodes.at(-1)
  if(!first){event.preventDefault();content.value?.focus();return}
  if(event.shiftKey&&(document.activeElement===first||!dialog()?.contains(document.activeElement))){event.preventDefault();last?.focus()}
  else if(!event.shiftKey&&(document.activeElement===last||!dialog()?.contains(document.activeElement))){event.preventDefault();first.focus()}
}
function unlock() {
  if(typeof document==='undefined')return
  document.removeEventListener('keydown',trap)
  if(previousOverflow!==null){if(document.body.style.overflow==='hidden')document.body.style.overflow=previousOverflow;previousOverflow=null}
}
watch(()=>props.tool,async(tool,old)=>{
  const run=++sequence
  if(typeof document==='undefined')return
  if(tool){
    if(!old){trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';document.addEventListener('keydown',trap)}
    await nextTick()
    if(run===sequence&&props.tool===tool)(content.value?.querySelector<HTMLElement>('input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')||content.value)?.focus()
  }else{unlock();await nextTick();if(run===sequence&&trigger?.isConnected)trigger.focus();trigger=null}
},{immediate:true})
watch(activeDialogState,async value=>{
  if(!props.tool||typeof document==='undefined')return
  if(value){confirmFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;await nextTick();if(!disposed&&props.tool&&activeDialogState.value===value)focusables()[0]?.focus()}
  else {await nextTick();if(!disposed&&props.tool&&!activeDialogState.value){if(confirmFocus?.isConnected&&!confirmFocus.matches(':disabled'))confirmFocus.focus();else focusables()[0]?.focus()}confirmFocus=null}
})
onBeforeUnmount(()=>{disposed=true;sequence++;unlock();if(trigger?.isConnected)trigger.focus()})
</script>
<template>
  <FpDialog :open="!!tool" :title="info.title" :width="tool==='paint'?620:480" :persistent="Boolean(activeDialogState)" :closable="!activeDialogState" @close="emit('close')">
    <div v-if="tool" ref="content" class="chat-tool-content" :class="'tool-'+tool" tabindex="-1">
      <p v-if="tool!=='barrage'" class="tool-intro">{{ info.hint }}</p>
      <ChatRedPacketEditor v-if="tool==='packet'" @close="emit('close')" />
      <ChatBarrageEditor v-else-if="tool==='barrage'" @close="emit('close')" />
      <PaintPanel v-else @insert="md=>emit('insert',md)" @close="emit('close')" />
    </div>
  </FpDialog>
</template>
<style scoped>
.chat-tool-content{outline:none;min-width:0}.tool-intro{margin:0 0 20px;color:var(--fp-muted);font-size:12px;line-height:1.8}
.chat-tool-content :deep(label){font-size:13px;line-height:1.6;color:var(--fp-text);gap:8px;min-width:0}
.chat-tool-content :deep(input:not([type=color]):not([type=range])),.chat-tool-content :deep(select){padding:10px 12px;min-height:40px;border-radius:8px;background:var(--fp-surface-subtle);color:var(--fp-text);border:1px solid var(--fp-border)}
.chat-tool-content :deep(button){padding:8px 13px;border:1px solid var(--fp-border);border-radius:8px;background:var(--fp-card);color:var(--fp-text);font-size:12px;cursor:pointer;margin:0}
.chat-tool-content :deep(button[type=submit]),.chat-tool-content :deep(.green){background:var(--fp-primary);border-color:var(--fp-primary);color:#fff}
.chat-tool-content :deep(button:disabled){cursor:default;opacity:.45}.chat-tool-content :deep(:is(button,input,select):focus-visible){outline:2px solid var(--fp-primary);outline-offset:2px}
.chat-tool-content :deep(.packet-editor){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;padding:0}.chat-tool-content :deep(.packet-editor>label:first-child),.chat-tool-content :deep(.packet-editor>label:has(input[maxlength])),.chat-tool-content :deep(.packet-editor>p),.chat-tool-content :deep(.packet-editor>div){grid-column:1/-1}
.chat-tool-content :deep(.packet-editor>div){display:flex;justify-content:flex-end;gap:10px;padding-top:16px;border-top:1px solid var(--fp-border)}
.chat-tool-content :deep(.packet-editor>p){font-size:11px;line-height:1.8}
.chat-tool-content :deep(.paint){display:flex;flex-direction:column;gap:16px;margin:0;padding:0}.chat-tool-content :deep(.paint canvas){max-width:100%;border-radius:10px;order:0}.chat-tool-content :deep(.paint .tools){order:1;margin:0;padding-top:16px;border-top:1px solid var(--fp-border);gap:10px}.chat-tool-content :deep(.paint .tools .green){margin-left:auto}.chat-tool-content :deep(.paint .err){order:2}
@media(max-width:480px){.chat-tool-content :deep(.packet-editor){gap:12px}.chat-tool-content :deep(.paint .tools .green){margin-left:0}.chat-tool-content :deep(.packet-editor>div){flex-wrap:wrap}}
</style>
