<script setup lang="ts">
import { computed, ref } from 'vue'
import EmojiPicker from '@/components/EmojiPicker.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    apiKey?: string | null
    /** chat：聊天室完整工具栏；compact：私信精简工具栏 */
    variant?: 'chat' | 'compact'
    cacheId?: string
    placeholder?: string
    height?: number
    sending?: boolean
    disabled?: boolean
    /** 正文为空也允许发送（如带引用） */
    allowEmpty?: boolean
  }>(),
  {
    apiKey: null,
    variant: 'chat',
    cacheId: '',
    placeholder: '',
    height: 150,
    sending: false,
    disabled: false,
    allowEmpty: false,
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: string]; submit: [] }>()

const root = ref<HTMLElement | null>(null)
const editor = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const canSend = computed(
  () => !props.sending && !props.disabled && (props.allowEmpty || Boolean(props.modelValue.trim())),
)

function submit() {
  if (canSend.value) emit('submit')
}

function reveal() {
  editor.value?.focus()
  root.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

defineExpose({
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
      :api-key="apiKey"
      :height="height"
      :chat="variant === 'chat'"
      :compact="variant === 'compact'"
      :cache-id="cacheId"
      :placeholder="placeholder"
      @update:model-value="(v: string) => emit('update:modelValue', v)"
      @submit="submit"
    />
    <div class="bar">
      <div class="tools">
        <EmojiPicker @insert="(md) => editor?.insert(md)" />
        <slot name="tools" />
      </div>
      <div class="actions">
        <slot name="actions" />
        <button type="button" class="send" :disabled="!canSend" @click="submit">
          {{ sending ? '发送中…' : '发 送' }}
        </button>
      </div>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.tools,
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.actions {
  margin-left: auto;
}
.send {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 6px;
  padding: 6px 18px;
  font-size: 13px;
  cursor: pointer;
}
.send:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
