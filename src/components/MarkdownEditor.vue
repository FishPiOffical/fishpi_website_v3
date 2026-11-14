<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAppearanceStore } from '@/stores/appearance'
import FpLoading from '@/components/FpLoading.vue'
import EmojiPicker from '@/components/EmojiPicker.vue'
import { createMarkdownPreview } from '@/utils/markdownPreview'
import { createEditorUpload } from '@/utils/editorUpload'
import { createMentionHints } from '@/utils/mentionHints'
import { getAuthContextVersion, onAccessTokenChange } from '@/api/http'

const props = withDefaults(
  defineProps<{
    modelValue: string
    height?: number
    adaptiveHeight?: boolean
    disableSubmitShortcut?: boolean
    placeholder?: string
    outline?: boolean
    /** reply：聊天室 / 私信 / 回帖共用的短文工具栏，仅编辑区；post：发帖的长文工具栏，分屏预览 */
    mode?: 'reply' | 'post'
    /** 私信输入使用精简工具栏，避免显示发帖和长文编辑功能 */
    toolbarPreset?: 'default' | 'message'
    /** 启用本地草稿缓存（Vditor localStorage），值为缓存键 */
    cacheId?: string
  }>(),
  { height: 500, placeholder: '', outline: false, mode: 'post', toolbarPreset: 'default', cacheId: '' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string]; submit: []; 'emoji-open': [open: boolean]; 'content-state': [hasContent: boolean] }>()

const VDITOR_CDN = 'https://file.fishpi.cn/vditor/latest/dist'

interface VditorInstance {
  readonly vditor?: { lute?: { GetEmojis(): Record<string, unknown> } }
  focus(): void
  getValue(): string
  setValue(value: string, clearStack?: boolean): void
  insertMD(value: string): void
  setTheme(theme: 'classic' | 'dark', contentTheme?: string, codeTheme?: string, contentThemePath?: string): void
  destroy(): void
}
type VditorCtor = new (el: HTMLElement, options: Record<string, unknown>) => VditorInstance

let loader: Promise<VditorCtor> | null = null

const MORE_TOOLS = ['outdent', 'indent', 'insert-before', 'insert-after', 'line', 'info', 'help']

const REPLY_TOOLBAR = [
  'emoji',
  'headings',
  'bold',
  'italic',
  'strike',
  'link',
  '|',
  'list',
  'ordered-list',
  'check',
  'quote',
  'code',
  'inline-code',
  '|',
  'upload',
  'table',
  '|',
  'undo',
  'redo',
  '|',
  'edit-mode',
  'fullscreen',
  { name: 'more', toolbar: MORE_TOOLS },
]

const POST_TOOLBAR = [
  ...REPLY_TOOLBAR.slice(0, -3),
  'record',
  '|',
  'edit-mode',
  'both',
  'preview',
  'outline',
  'fullscreen',
  { name: 'more', toolbar: MORE_TOOLS },
]

const MOBILE_TOOLBAR = [
  'emoji',
  'bold',
  'link',
  'upload',
  'edit-mode',
  {
    name: 'more',
    toolbar: ['headings', 'italic', 'strike', 'quote', 'list', 'ordered-list', 'check', 'code', 'inline-code', 'table', 'undo', 'redo', 'fullscreen', 'preview', 'info', 'help'],
  },
]

const MESSAGE_TOOLBAR = ['emoji', 'bold', 'italic', 'link', 'upload']

function loadVditor(): Promise<VditorCtor> {
  const w = window as unknown as { Vditor?: VditorCtor }
  if (w.Vditor) return Promise.resolve(w.Vditor)
  if (loader) return loader
  loader = new Promise<VditorCtor>((resolve, reject) => {
    if (!document.querySelector(`link[href^="${VDITOR_CDN}"]`)) {
      const css = document.createElement('link')
      css.rel = 'stylesheet'
      css.href = `${VDITOR_CDN}/index.css`
      document.head.appendChild(css)
    }
    const script = document.createElement('script')
    script.src = `${VDITOR_CDN}/index.min.js`
    script.onload = () => (w.Vditor ? resolve(w.Vditor) : reject(new Error('Vditor 未注册')))
    script.onerror = () => reject(new Error('编辑器加载失败'))
    document.head.appendChild(script)
  }).catch((e) => {
    loader = null
    throw e
  })
  return loader
}

const host = ref<HTMLElement | null>(null)
const emojiPicker = ref<InstanceType<typeof EmojiPicker> | null>(null)
const nativeEmojis = ref<Record<string, string>>({})
const fallback = ref(false)
const ready = ref(false)
const fallbackInput = ref<HTMLTextAreaElement | null>(null)
let editor: VditorInstance | null = null
let lastEmitted = props.modelValue
let lastRenderedValue: string | undefined
const preview = createMarkdownPreview(() => editor?.getValue() ?? props.modelValue)
const uploads = createEditorUpload(markdown => editor?.insertMD(markdown))
const mentionError = ref('')
const mentions = createMentionHints(message => { mentionError.value = message })
let composing = false
let disposed = false
function reportContentState() {
  if (disposed) return
  const value = fallback.value ? fallbackInput.value?.value ?? props.modelValue : editor?.getValue() ?? props.modelValue
  emit('content-state', !composing && Boolean(value.trim()))
}
function onImmediateInput(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.matches('[contenteditable], .md-fallback')) return
  // 等当前输入事件完成 DOM 更新，只同步是否有内容，不触发预览、草稿或撤销栈写入。
  queueMicrotask(reportContentState)
}
function onCompositionStart() {
  composing = true
  emit('content-state', false)
}
function onCompositionEnd() {
  composing = false
  queueMicrotask(reportContentState)
}
function clearMentions() {
  mentions.cancel()
  // Toolbar dropdowns also use .vditor-hint; only clear the editor's suggestion panel.
  host.value?.querySelectorAll<HTMLElement>('.vditor-content > .vditor-hint').forEach(element => { element.replaceChildren(); element.style.display = 'none' })
}
let stopPreviewAuth: (() => void) | undefined

const appearance = useAppearanceStore()
const dark = computed(() => appearance.state.theme.includes('dark'))
const CONTENT_THEME_PATH = `${VDITOR_CDN}/css/content-theme`

function insertEmoji(markdown: string) {
  if (editor && ready.value) { editor.insertMD(markdown); reportContentState() }
  else emit('update:modelValue', props.modelValue + markdown)
}
function toggleEmoji(anchor?: HTMLElement) {
  if (anchor) emojiPicker.value?.toggle(anchor, 'above')
  else emojiPicker.value?.toggle(host.value?.querySelector<HTMLElement>('[data-type="v3-emoji"]') ?? undefined, 'below')
}

function applyTheme() {
  if (!editor || !ready.value) return
  editor.setTheme(dark.value ? 'dark' : 'classic', dark.value ? 'dark' : 'light', dark.value ? 'native' : 'github', CONTENT_THEME_PATH)
}

onMounted(async () => {
  let version = getAuthContextVersion()
  stopPreviewAuth = onAccessTokenChange(token => {
    const next = getAuthContextVersion()
    if (!token || next !== version) { preview.reset(); uploads.cancel(); clearMentions() }
    version = next
  })
  let Vditor: VditorCtor
  try {
    Vditor = await loadVditor()
  } catch {
    fallback.value = true
    return
  }
  if (!host.value) return
  const narrow = window.innerWidth < 768
  const inline = props.mode === 'reply'
  const toolbar = props.toolbarPreset === 'message'
    ? MESSAGE_TOOLBAR
    : narrow ? MOBILE_TOOLBAR : inline ? REPLY_TOOLBAR : POST_TOOLBAR
  const resolvedToolbar = toolbar.map(item => item === 'emoji' ? {
    name: 'v3-emoji', tip: '表情', hotkey: '⌘E',
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/><path d="M8 14q4 5 8 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    click: () => toggleEmoji(),
  } : item)
  editor = new Vditor(host.value, {
    value: props.modelValue,
    height: props.height,
    placeholder: props.placeholder,
    cache: props.cacheId ? { enable: true, id: props.cacheId } : { enable: false },
    lang: 'zh_CN',
    theme: dark.value ? 'dark' : 'classic',
    outline: { enable: props.outline, position: 'left' },
    resize: { enable: props.adaptiveHeight || !narrow, position: 'bottom' },
    preview: { delay: 750, mode: inline ? 'editor' : 'both', transform: preview.transform, parse: preview.parse },
    counter: { enable: !inline },
    toolbar: resolvedToolbar,
    toolbarConfig: { pin: !inline },
    ctrlEnter: props.disableSubmitShortcut ? undefined : () => emit('submit'),
    upload: {
      accept: 'image/*,.zip,.rar,.7z,.mp3,.mp4,.webm,.mov',
      handler: uploads.handler,
    },
    hint: {
      parse: false,
      emoji: {},
      emojiTail: '',
      extend: [{ key: '@', hint: mentions.hint }],
    },
    input: (value: string) => {
      reportContentState()
      preview.reset()
      lastEmitted = value
      lastRenderedValue = value
      emit('update:modelValue', value)
    },
    after: () => {
      // Display Unicode and bundled image labels; insertion stays the server-provided alias.
      const labels: Record<string, string> = Object.create(null)
      const local = editor?.vditor?.lute?.GetEmojis() || {}
      for (const [alias, value] of Object.entries(local)) {
        if (!/^[A-Za-z0-9_+-]{1,64}$/.test(alias) || typeof value !== 'string' || value.length > 64) continue
        const unicode = /[^\u0000-\u007f]/u.test(value) && !/[A-Za-z_<>/:.\\\u0000-\u001f\u007f]/u.test(value)
        const bundledImage = /^\$\{emojiSite\}\/[a-z0-9_-]+\.(?:png|gif|webp)$/i.test(value)
        if (unicode || bundledImage) labels[alias] = value
      }
      nativeEmojis.value = labels
      ready.value = true
      const cached = editor?.getValue().replace(/\n$/, '') || ''
      if (props.modelValue !== lastEmitted) editor?.setValue(props.modelValue, true)
      else if (!props.modelValue && cached.trim()) {
        lastEmitted = cached
        emit('update:modelValue', cached)
      }
      lastRenderedValue = editor?.getValue()
      reportContentState()
      if (dark.value) applyTheme()
    },
  })
})

watch(dark, applyTheme)

watch(
  () => props.modelValue,
  (value) => {
    if (!editor || !ready.value || value === lastEmitted) return
    preview.reset()
    uploads.cancel()
    clearMentions()
    lastEmitted = value
    editor.setValue(value, true)
    lastRenderedValue = editor.getValue()
    reportContentState()
  },
)

onBeforeUnmount(() => {
  disposed = true
  stopPreviewAuth?.()
  preview.dispose()
  uploads.dispose()
  mentions.dispose()
  editor?.destroy()
  editor = null
})

defineExpose({
  flush() {
    if (!fallback.value && (!editor || !ready.value)) throw new Error('编辑器仍在加载，请稍后再试')
    const value = fallback.value ? fallbackInput.value?.value ?? props.modelValue : editor!.getValue()
    if (!fallback.value && value === lastRenderedValue) return lastEmitted
    lastEmitted = value
    lastRenderedValue = value
    emit('update:modelValue', value)
    return value
  },
  focus() {
    if (fallback.value) fallbackInput.value?.focus()
    else if (!host.value?.contains(document.activeElement) || !document.activeElement?.matches('[contenteditable]')) editor?.focus()
  },
  insert: insertEmoji,
  toggleEmoji,
})
</script>

<template>
  <div class="md-editor" :class="[`md-editor--${mode}`, { 'md-adaptive': adaptiveHeight }]" @input.capture="clearMentions" @input="onImmediateInput"
    @compositionstart="onCompositionStart" @compositionend="onCompositionEnd">
    <EmojiPicker ref="emojiPicker" :show-trigger="false" placement="below" :labels="nativeEmojis"
      @insert="insertEmoji" @open-change="emit('emoji-open', $event)" />
    <textarea
      v-if="fallback"
      ref="fallbackInput"
      class="md-fallback"
      :value="modelValue"
      :placeholder="placeholder"
      :style="{ height: `${height}px` }"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <template v-else>
      <div ref="host" />
      <p v-if="mentionError" role="status">{{ mentionError }}</p>
      <div v-if="!ready" class="md-loading" :style="{ height: `${height}px` }"><FpLoading small /></div>
    </template>
  </div>
</template>

<style scoped>
.md-editor {
  position: relative;
}
.md-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1px solid var(--fp-border);
  border-radius: 6px;
  background: var(--fp-bg);
}
/* The root can resize without clipping the toolbar or the editor's own scrollbar. */
.md-adaptive :deep(.vditor:not(.vditor--fullscreen)),
.md-adaptive .md-fallback {
  min-height: 100px;
  max-height: clamp(120px, 40dvh, 360px);
}
.md-adaptive :deep(.vditor-content) { min-height: 0; }
.md-adaptive :deep(.vditor-toolbar) { flex-shrink: 0; }
.md-adaptive :deep(.vditor-resize) { z-index: 1; }
.md-adaptive :deep(.vditor-resize > div) { height: 10px; display: grid; place-items: center; }

@media (max-width: 767px) {
  .md-adaptive :deep(.vditor:not(.vditor--fullscreen)),
  .md-adaptive .md-fallback { height: auto !important; }
  .md-adaptive .md-fallback { field-sizing: content; resize: none; }
  .md-adaptive :deep(.vditor:not(.vditor--fullscreen) .vditor-resize) { display: none; }
  .md-adaptive :deep(.vditor:not(.vditor--fullscreen) .vditor-content) { flex: 0 1 auto; }
  .md-adaptive :deep(.vditor:not(.vditor--fullscreen) .vditor-content [contenteditable="true"]) {
    height: auto;
    min-height: 64px;
    max-height: 25dvh;
    overflow-y: auto;
  }
}

.md-fallback {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 8px 10px;
}
</style>

<style>
/* 鱼排编辑器主题：把 Vditor 的主题变量映射到站点 --fp-*，随站点明暗主题切换 */
.md-editor .vditor,
.md-editor .vditor.vditor--dark {
  --border-color: color-mix(in srgb, var(--fp-text) 14%, transparent);
  --second-color: color-mix(in srgb, var(--fp-muted) 55%, transparent);
  --panel-background-color: var(--fp-card);
  --panel-shadow: 0 6px 24px rgba(0, 0, 0, 0.16), 0 1px 3px rgba(0, 0, 0, 0.08);
  --toolbar-background-color: var(--fp-card);
  --toolbar-icon-color: var(--fp-muted);
  --toolbar-icon-hover-color: var(--fp-primary);
  --toolbar-height: 34px;
  --toolbar-divider-margin-top: 10px;
  --textarea-background-color: color-mix(in srgb, var(--fp-text) 4%, var(--fp-card));
  --textarea-text-color: var(--fp-text);
  --resize-icon-color: var(--fp-muted);
  --resize-background-color: transparent;
  --resize-hover-icon-color: #fff;
  --resize-hover-background-color: var(--fp-primary);
  --count-background-color: color-mix(in srgb, var(--fp-primary) 14%, transparent);
  --heading-border-color: var(--fp-border);
  --blockquote-color: var(--fp-muted);
  --ir-heading-color: var(--fp-primary);
  --ir-title-color: var(--fp-muted);
  --ir-bi-color: var(--fp-accent);
  --ir-link-color: var(--fp-link);
  --ir-bracket-color: var(--fp-link);
  --ir-paren-color: var(--fp-primary);

  border: 1px solid var(--border-color);
  border-radius: 8px;
  /* clip 不建立滚动容器，发帖页的工具栏吸顶才能生效 */
  overflow: clip;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.md-editor .vditor-toolbar--pin {
  top: var(--fp-nav-h);
}
.md-editor .vditor:focus-within {
  border-color: color-mix(in srgb, var(--fp-primary) 70%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--fp-primary) 16%, transparent);
}
.md-editor .vditor.vditor--fullscreen {
  border-radius: 0;
}

.md-editor .vditor-toolbar {
  padding: 0 6px !important;
  border-bottom: 1px solid var(--border-color);
}
.md-editor .vditor-toolbar__item {
  padding: 4px 1px;
}
.md-editor .vditor-toolbar__item .vditor-tooltipped {
  width: 26px;
  height: 26px;
  padding: 5px;
  border-radius: 6px;
  transition: background 0.15s ease, color 0.15s ease;
}
.md-editor .vditor-toolbar__item .vditor-tooltipped:hover,
.md-editor .vditor-toolbar__item .vditor-tooltipped:focus,
.md-editor .vditor-toolbar__item .vditor-menu--current {
  background: color-mix(in srgb, var(--fp-primary) 14%, transparent);
  color: var(--fp-primary);
}
.md-editor .vditor-toolbar__item svg {
  width: 16px;
  height: 16px;
}
.md-editor .vditor-toolbar__item input {
  top: 4px;
  width: 26px;
  height: 26px;
}
.md-editor .vditor-toolbar__divider {
  height: 14px;
  margin: 10px 6px;
}

.md-editor .vditor-sv,
.md-editor .vditor-ir pre.vditor-reset,
.md-editor .vditor-wysiwyg pre.vditor-reset,
.md-editor .vditor-sv:focus,
.md-editor .vditor-ir pre.vditor-reset:focus,
.md-editor .vditor-wysiwyg pre.vditor-reset:focus {
  background-color: var(--textarea-background-color);
  color: var(--textarea-text-color);
  caret-color: var(--fp-primary);
}
.md-editor--reply .vditor-sv,
.md-editor--reply .vditor-ir pre.vditor-reset,
.md-editor--reply .vditor-wysiwyg pre.vditor-reset {
  padding: 10px 14px !important;
  font-size: 14px;
  line-height: 1.7;
}
.md-editor .vditor-preview {
  border-left: 1px solid var(--border-color);
  background: var(--fp-card);
}

.md-editor .vditor-panel,
.md-editor .vditor-hint {
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.md-editor .vditor-hint button {
  color: var(--fp-text);
}
.md-editor .vditor-hint--current,
.md-editor .vditor-hint button:not(.vditor-menu--disabled):hover {
  background-color: color-mix(in srgb, var(--fp-primary) 14%, transparent) !important;
}
.md-editor .vditor-emojis button {
  border-radius: 6px;
}
.md-editor .vditor-emojis button:hover {
  background: color-mix(in srgb, var(--fp-primary) 14%, transparent);
}
.md-editor .vditor-counter {
  color: var(--fp-primary);
}
</style>
