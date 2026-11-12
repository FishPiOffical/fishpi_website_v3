<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import FpDialog from '@/components/FpDialog.vue'
import { CHAT_TAIL_MAX_LENGTH, chatTailLength, validateChatTail } from '@/api/v3-chat-tail'
import { getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useV3ChatTailStore } from '@/stores/v3ChatTail'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const store = useV3ChatTailStore(), auth = useAuthStore()
const panel = ref<HTMLElement | null>(null)
const enabled = ref(false), text = ref(''), dirty = ref(false), composing = ref(false)
const length = computed(() => chatTailLength(text.value))
const frozen = computed(() => store.busy || !!store.pending)
const validation = computed(() => {
  try { validateChatTail({ enabled: enabled.value, text: text.value }); return '' }
  catch (e) { return (e as Error).message }
})
const changed = computed(() => !!store.current && (enabled.value !== store.current.enabled || text.value !== store.current.text))
const identity = () => JSON.stringify([getAuthContextVersion(), !!auth.accessToken, auth.account?.oId || ''])
let previousOverflow: string | null = null, sequence = 0

function fill() {
  const value = store.pending || store.current
  if (!value) return
  enabled.value = value.enabled; text.value = value.text
}
function markDirty() { dirty.value = true }
function close() { emit('close') }
function save() {
  if (composing.value || frozen.value || store.loading || !changed.value || validation.value) return
  void store.save({ enabled: enabled.value, text: text.value })
}
function trap(event: KeyboardEvent) {
  if (!props.open || event.key !== 'Tab') return
  const dialog = panel.value?.closest('[role="dialog"]')
  const nodes = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]') || []).filter(node => node.getClientRects().length)
  const first = nodes[0], last = nodes.at(-1)
  if (!first) { event.preventDefault(); panel.value?.focus(); return }
  if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
}
function unlock() {
  if (typeof document === 'undefined') return
  document.removeEventListener('keydown', trap)
  if (previousOverflow !== null) {
    if (document.body.style.overflow === 'hidden') document.body.style.overflow = previousOverflow
    previousOverflow = null
  }
}
watch(() => props.open, async open => {
  const run = ++sequence
  if (typeof document === 'undefined') return
  if (!open) {
    unlock(); await nextTick()
    if (run === sequence) document.querySelector<HTMLElement>('[aria-label="打开设置"]')?.focus()
    return
  }
  dirty.value = false; composing.value = false; enabled.value = false; text.value = ''; fill()
  previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', trap)
  if (!store.pending && !store.busy) void store.load()
  await nextTick()
  if (run === sequence && props.open) panel.value?.focus()
}, { immediate: true })
watch(() => store.current, () => { if (props.open && !dirty.value) fill() })
watch(() => store.confirmed, () => { if (props.open) dirty.value = false })
watch(identity, () => { enabled.value = false; text.value = ''; dirty.value = false; if (props.open) close() }, { flush: 'sync' })
onBeforeUnmount(() => { sequence++; unlock() })
</script>

<template>
  <FpDialog :open="open" title="聊天室小尾巴" :width="440" @close="close">
    <form ref="panel" class="chat-tail-settings" tabindex="-1" @submit.prevent="save">
      <p class="tail-hint">普通消息末尾的小签名，设置会随账号同步。</p>
      <div v-if="store.error" class="tail-error" role="alert">{{ store.error }}<button type="button" class="tail-icon" aria-label="重新读取小尾巴设置" title="重新读取" :disabled="store.loading || store.busy" @click="store.load">↻</button></div>
      <p v-else-if="store.loading && !store.current" class="tail-hint" role="status">正在读取设置…</p>
      <template v-if="store.current || store.pending || dirty">
        <label class="tail-switch"><input v-model="enabled" type="checkbox" :disabled="frozen" @change="markDirty">启用小尾巴</label>
        <label class="tail-field" for="chat-tail-text">内容<span :class="{ 'over-limit': length !== null && length > CHAT_TAIL_MAX_LENGTH }">{{ length === null ? '最多 24 字' : `${length} / ${CHAT_TAIL_MAX_LENGTH}` }}</span></label>
        <input id="chat-tail-text" v-model="text" class="tail-input" type="text" :disabled="frozen" placeholder="写一句你的小尾巴" autocomplete="off" @input="markDirty" @compositionstart="composing = true" @compositionend="composing = false">
        <small class="tail-hint">仅单行文字和 Emoji，组合表情按一个计数。</small>
        <div class="tail-preview" aria-label="小尾巴预览"><span>今天也要开心摸鱼</span><span v-if="enabled && text.trim()" class="tail-preview-text"><svg class="tail-preview-label" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="小尾巴"><title>小尾巴</title><path fill="currentColor" stroke="none" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg><span>{{ text }}</span></span></div>
        <p class="tail-hint">特殊卡片、纯图片和纯引用不附加；精简模式会隐藏小尾巴。修改不影响历史消息。</p>
      </template>
      <p v-if="dirty && validation" class="tail-error" role="alert">{{ validation }}</p>
      <p v-if="store.writeError" class="tail-error" role="alert">{{ store.writeError }}<button v-if="store.pending" type="button" class="tail-icon" :disabled="store.busy" aria-label="重试保存小尾巴" title="重试保存" @click="store.retry">↻</button></p>
      <div class="tail-actions"><button type="button" @click="close">取消</button><button type="submit" class="tail-save" :disabled="!store.current || !changed || !!validation || frozen || store.loading || composing">{{ store.busy ? '保存中…' : '保存' }}</button></div>
    </form>
  </FpDialog>
</template>

<style scoped>
.chat-tail-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  outline: none;
}
.tail-hint {
  margin: 0;
  color: var(--fp-muted);
  font-size: 12px;
  line-height: 1.7;
}
.tail-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.tail-switch input { accent-color: var(--fp-primary); }
.tail-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}
.tail-field span { font-size: 12px; color: var(--fp-muted); }
.tail-field .over-limit, .tail-error { color: var(--fp-danger); }
.tail-input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-bg);
  color: var(--fp-text);
  font: inherit;
  font-size: 14px;
}
.tail-input:focus {
  outline: 2px solid color-mix(in srgb, var(--fp-primary) 25%, transparent);
  outline-offset: 2px;
  border-color: var(--fp-primary);
}
.tail-preview {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 14px;
  border: 1px solid var(--fp-border);
  border-radius: 4px 12px 12px;
  background: var(--fp-hover);
  font-size: 14px;
  overflow-wrap: anywhere;
}
.tail-preview-text {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid color-mix(in srgb, var(--fp-muted) 22%, transparent);
  font-size: 12px;
  line-height: 1.4;
  color: var(--fp-muted);
  white-space: pre-wrap;
}
.tail-preview-label { flex: none; width: 13px; height: 13px; align-self: flex-start; margin-top: 2px; }
.tail-error { margin: 0; font-size: 12px; line-height: 1.7; }
.tail-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
.tail-actions button {
  padding: 8px 18px;
  border: 1px solid var(--fp-border);
  border-radius: 7px;
  background: var(--fp-card);
  color: var(--fp-text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.tail-actions .tail-save {
  background: var(--fp-primary);
  border-color: var(--fp-primary);
  color: #fff;
}
.tail-icon {
  margin-left: 6px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: var(--fp-hover);
  color: inherit;
  font-size: 18px;
  cursor: pointer;
}
button:disabled, .tail-input:disabled { opacity: .55; cursor: default; }
</style>
