<script setup lang="ts">
import { computed, ref } from 'vue'
import EmojiPicker from '@/components/EmojiPicker.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    cacheId?: string
    placeholder?: string
    height?: number
    sending?: boolean
    disabled?: boolean
    /** 正文为空也允许发送（如带引用） */
    allowEmpty?: boolean
    submitText?: string
    /** 私信等场景只保留常用的格式、链接和图片工具 */
    compact?: boolean
  }>(),
  {
    cacheId: '',
    placeholder: '',
    height: 150,
    sending: false,
    disabled: false,
    allowEmpty: false,
    submitText: '发 送',
    compact: false,
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: string]; submit: [] }>()

const sendError = ref('')
const root = ref<HTMLElement | null>(null)
const editor = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const emojiLabels = ref<Record<string, string>>({})
const canSend = computed(
  () => !props.sending && !props.disabled && (props.allowEmpty || Boolean(props.modelValue.trim())),
)

function flush() {
  sendError.value = ''
  try {
    return editor.value?.flush() ?? props.modelValue
  } catch (reason) {
    sendError.value = reason instanceof Error ? reason.message : '编辑器内容暂不可读取'
    return null
  }
}

function submit() {
  if (props.sending || props.disabled) return
  const value = flush()
  if (value !== null && (props.allowEmpty || value.trim())) emit('submit')
}

function reveal() {
  editor.value?.focus()
  root.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

defineExpose({
  flush,
  focus: () => editor.value?.focus(),
  reveal,
  insert: (text: string) => editor.value?.insert(text),
})
</script>

<template>
  <div ref="root" class="composer">
    <slot name="top" />
    <MarkdownEditor
      ref="editor"
      :model-value="modelValue"
      :height="height"
      mode="reply"
      :toolbar-preset="compact ? 'message' : 'default'"
      :cache-id="cacheId"
      :placeholder="placeholder"
      @update:model-value="(v: string) => emit('update:modelValue', v)"
      @submit="submit"
      @emoji-labels="emojiLabels = $event"
    />
    <p v-if="sendError" role="alert">{{ sendError }}</p>
    <div v-if="$slots.context" class="composer-context"><slot name="context" /></div>
    <div class="bar">
      <div class="tools">
        <EmojiPicker v-if="!compact" :labels="emojiLabels" @insert="(md) => editor?.insert(md)" />
        <slot name="tools" />
      </div>
      <div class="actions">
        <slot name="actions" />
        <button type="button" class="send" :disabled="!canSend" @click="submit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m21 3-7 18-4-7-7-4L21 3ZM10 14 21 3" /></svg>
          {{ sending ? '发送中…' : submitText }}
        </button>
      </div>
    </div>
    <slot />
  </div>
</template>

<style scoped lang="scss">
.composer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px 16px;
  padding-top: 2px;
}
.tools,
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.actions {
  margin-left: auto;
}
.send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 9px;
  padding: 8px 18px;
  min-height: 36px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color .16s, opacity .16s, box-shadow .16s;
  svg { width: 16px; height: 16px; }
  &:hover:not(:disabled) { box-shadow: 0 3px 10px color-mix(in srgb, var(--fp-primary) 20%, transparent); }
}
.send:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.composer-context { min-width: 0; }
.tools :deep(.emoji > .ghost) {
  display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 6px 9px;
  border: 1px solid transparent; border-radius: 8px; font-size: 12px; color: var(--fp-muted);
  transition: background-color .16s, color .16s;
  &:hover, &[aria-expanded='true'] { background: var(--fp-hover); color: var(--fp-title); }
}
@media (max-width: 600px) {
  .bar { gap: 8px; }
  .tools { flex: 1 1 100%; gap: 2px; }
  .actions { justify-content: flex-end; }
}
</style>
