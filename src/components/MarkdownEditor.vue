<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAppearanceStore } from '@/stores/appearance'
import FpLoading from '@/components/FpLoading.vue'
import EmojiPicker from '@/components/EmojiPicker.vue'
import { createMarkdownPreview } from '@/utils/markdownPreview'
import { loadVditor, VDITOR_CDN, type VditorCtor, type VditorInstance } from '@/utils/markdownEditorAssets'
import { createEditorUpload, editorUploadAccept, type EditorUploadStatus } from '@/utils/editorUpload'
import { createMentionHints } from '@/utils/mentionHints'
import { getAuthContextVersion, onAccessTokenChange } from '@/api/http'

const props = withDefaults(
  defineProps<{
    modelValue: string
    height?: number
    adaptiveHeight?: boolean
    /** 聊天室编辑器拖动边缘，顶部和底部独立保存本机高度 */
    resizeEdge?: 'top' | 'bottom'
    disableSubmitShortcut?: boolean
    instantInput?: boolean
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

const minHeight = 100
const desktopHeightLimit = 360
const maxHeight = ref(desktopHeightLimit)
const savedHeight = ref<number>()
const draggedHeight = ref<number>()
const resizeKey = computed(() => `fp.chat.editor-height.${props.resizeEdge}`)
const displayedHeight = computed(() => clampHeight(draggedHeight.value ?? savedHeight.value ?? props.height))
let resizeDrag: { pointerId: number; y: number; height: number } | undefined

function clampHeight(height: number) {
  return Math.round(Math.min(maxHeight.value, Math.max(minHeight, height)))
}

function updateHeightLimit() {
  maxHeight.value = Math.round(Math.min(desktopHeightLimit, Math.max(120, window.innerHeight * 0.4)))
}

function saveHeight(height: number) {
  savedHeight.value = height
  try { localStorage.setItem(resizeKey.value, String(height)) } catch { /* 存储不可用时，本次打开仍可调整 */ }
}

function startResize(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0 || resizeDrag) return
  const handle = event.currentTarget as HTMLElement
  event.preventDefault()
  handle.focus({ preventScroll: true })
  handle.setPointerCapture(event.pointerId)
  resizeDrag = { pointerId: event.pointerId, y: event.clientY, height: displayedHeight.value }
}

function moveResize(event: PointerEvent) {
  if (resizeDrag?.pointerId !== event.pointerId) return
  const delta = event.clientY - resizeDrag.y
  draggedHeight.value = clampHeight(resizeDrag.height + (props.resizeEdge === 'top' ? -delta : delta))
}

function endResize(event: PointerEvent) {
  if (resizeDrag?.pointerId !== event.pointerId) return
  if (event.type === 'pointerup' && displayedHeight.value !== resizeDrag.height) saveHeight(displayedHeight.value)
  resizeDrag = undefined
  draggedHeight.value = undefined
}

function resizeWithKeys(event: KeyboardEvent) {
  if (resizeDrag) return
  const increaseKey = props.resizeEdge === 'top' ? 'ArrowUp' : 'ArrowDown'
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
  event.preventDefault()
  const nextHeight = clampHeight(displayedHeight.value + (event.key === increaseKey ? 12 : -12))
  if (nextHeight !== displayedHeight.value) saveHeight(nextHeight)
}

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

const host = ref<HTMLElement | null>(null)
const emojiPicker = ref<InstanceType<typeof EmojiPicker> | null>(null)
const nativeEmojis = ref<Record<string, string>>({})
const fallback = ref(false)
const ready = ref(false)
const fallbackInput = ref<HTMLTextAreaElement | null>(null)
const plainInput = computed(() => fallback.value || (props.instantInput && !ready.value))
const plainDraft = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
let editor: VditorInstance | null = null
let lastEmitted = props.modelValue
let lastRenderedValue: string | undefined
const preview = createMarkdownPreview(() => editor?.getValue() ?? props.modelValue, props.mode === 'post')
const uploadStatus = ref<EditorUploadStatus>(null)
const uploads = createEditorUpload(markdown => {
  editor?.insertMD(markdown)
  reportContentState()
}, status => { uploadStatus.value = status })
const mentionError = ref('')
const mentions = createMentionHints(message => { mentionError.value = message })
let composing = false
let disposed = false
let richLoaded = false
let compositionFrame: number | undefined
function reportContentState() {
  if (disposed) return
  const value = plainInput.value ? fallbackInput.value?.value ?? props.modelValue : editor?.getValue() ?? props.modelValue
  emit('content-state', !composing && Boolean(value.trim()))
}
function onImmediateInput(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.matches('[contenteditable], .md-fallback')) return
  // 等当前输入事件完成 DOM 更新，只同步是否有内容，不触发预览、草稿或撤销栈写入。
  queueMicrotask(reportContentState)
}
function onCompositionStart() {
  if (compositionFrame !== undefined) cancelAnimationFrame(compositionFrame)
  compositionFrame = undefined
  composing = true
  emit('content-state', false)
}
function onCompositionEnd(event: Event) {
  if (props.instantInput && event.target === fallbackInput.value) {
    if (compositionFrame !== undefined) cancelAnimationFrame(compositionFrame)
    // 等确认选字后的最后一个 input 更新文本框，再把编辑权移交给 Vditor。
    compositionFrame = requestAnimationFrame(() => {
      compositionFrame = undefined
      composing = false
      upgradePlainInput()
      reportContentState()
    })
    return
  }
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

function visibleEditorField() {
  return Array.from(host.value?.querySelectorAll<HTMLElement>(
    '.vditor-sv[contenteditable="true"], .vditor-ir > [contenteditable="true"], .vditor-wysiwyg > [contenteditable="true"]',
  ) ?? []).find(element => element.getClientRects().length > 0)
}

function insertText(text: string) {
  const field = ready.value ? visibleEditorField() : undefined
  if (field) {
    field.focus({ preventScroll: true })
    // 通过原生文本输入保留 @ 后的普通空格及编辑器光标，Markdown 解析会裁掉行尾空格。
    if (document.activeElement === field && document.execCommand('insertText', false, text)) {
      reportContentState()
      return
    }
  }
  insertEmoji(text)
}

function destroyEditor() {
  editor?.destroy()
  editor = null
}

function upgradePlainInput() {
  if (!richLoaded || ready.value || disposed || composing || !editor) return
  const input = fallbackInput.value
  const value = input?.value ?? props.modelValue
  const selection = input && document.activeElement === input ? [input.selectionStart, input.selectionEnd] as const : null
  lastEmitted = value
  if (value !== props.modelValue) emit('update:modelValue', value)
  editor.setValue(value, true)
  lastRenderedValue = editor.getValue()
  ready.value = true
  reportContentState()
  if (dark.value) applyTheme()
  if (!selection) return
  void nextTick(() => {
    const field = visibleEditorField()
    if (!field || disposed || document.activeElement !== document.body) return
    field.focus({ preventScroll: true })
    const range = document.createRange()
    range.selectNodeContents(field)
    range.collapse(false)
    // 对内容相同的纯文本保留选区。Markdown 经过富文本转换时，光标放在正文末尾。
    if (field.textContent === value || field.textContent === `${value}\n`) {
      const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT)
      let offset = 0
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const end = offset + (node.textContent?.length ?? 0)
        if (selection[0] >= offset && selection[0] <= end) range.setStart(node, selection[0] - offset)
        if (selection[1] >= offset && selection[1] <= end) {
          range.setEnd(node, selection[1] - offset)
          break
        }
        offset = end
      }
    }
    const currentSelection = window.getSelection()
    currentSelection?.removeAllRanges()
    currentSelection?.addRange(range)
  })
}

onMounted(async () => {
  if (props.resizeEdge) {
    updateHeightLimit()
    window.addEventListener('resize', updateHeightLimit)
    try {
      const height = Number(localStorage.getItem(resizeKey.value))
      if (Number.isInteger(height) && height >= minHeight && height <= desktopHeightLimit) savedHeight.value = height
    } catch { /* 存储不可用时使用默认高度 */ }
  }
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
    if (!disposed) fallback.value = true
    return
  }
  if (disposed || !host.value) return
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
    resize: { enable: !props.resizeEdge && (props.adaptiveHeight || !narrow), position: 'bottom' },
    preview: { delay: 750, mode: inline ? 'editor' : 'both', transform: preview.transform, parse: preview.parse },
    counter: { enable: !inline },
    toolbar: resolvedToolbar,
    toolbarConfig: { pin: !inline },
    ctrlEnter: props.disableSubmitShortcut ? undefined : () => emit('submit'),
    upload: {
      accept: editorUploadAccept,
      // 自定义上传由编辑器统一展示状态，避免 Vditor 再弹一次相同错误。
      handler: async (files: File[]) => { await uploads.handler(files) },
    },
    hint: {
      parse: false,
      emoji: {},
      emojiTail: '',
      extend: [{ key: '@', hint: mentions.hint }],
    },
    input: (value: string) => {
      if (disposed || (props.instantInput && !ready.value)) return
      reportContentState()
      preview.reset()
      lastEmitted = value
      lastRenderedValue = value
      emit('update:modelValue', value)
    },
    after: () => {
      if (disposed) { destroyEditor(); return }
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
      if (props.instantInput) {
        richLoaded = true
        upgradePlainInput()
        return
      }
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
  if (props.resizeEdge) window.removeEventListener('resize', updateHeightLimit)
  disposed = true
  if (compositionFrame !== undefined) cancelAnimationFrame(compositionFrame)
  stopPreviewAuth?.()
  preview.dispose()
  uploads.dispose()
  mentions.dispose()
  // 即时输入可能在 Vditor 内部初始化前离页，此时等 after 再销毁实例。
  if (!props.instantInput || richLoaded) destroyEditor()
})

defineExpose({
  flush() {
    if (!plainInput.value && (!editor || !ready.value)) throw new Error('编辑器仍在加载，请稍后再试')
    if (props.instantInput && plainInput.value && composing) throw new Error('请先确认输入法选字')
    const value = plainInput.value ? fallbackInput.value?.value ?? props.modelValue : editor!.getValue()
    if (!plainInput.value && value === lastRenderedValue) return lastEmitted
    lastEmitted = value
    lastRenderedValue = value
    emit('update:modelValue', value)
    return value
  },
  focus(options?: FocusOptions) {
    if (plainInput.value) {
      fallbackInput.value?.focus(options)
      return
    }
    if (host.value?.contains(document.activeElement) && document.activeElement?.matches('[contenteditable]')) return
    if (options?.preventScroll && host.value) {
      const field = visibleEditorField()
      if (field) {
        field.focus(options)
        return
      }
    }
    editor?.focus()
  },
  insert: insertEmoji,
  insertText,
  toggleEmoji,
})
</script>

<template>
  <div class="md-editor" :class="[`md-editor--${mode}`, { 'md-adaptive': adaptiveHeight }]" @input.capture="clearMentions" @input="onImmediateInput"
    @compositionstart="onCompositionStart" @compositionend="onCompositionEnd">
    <EmojiPicker ref="emojiPicker" :show-trigger="false" placement="below" :labels="nativeEmojis"
      @insert="insertEmoji" @open-change="emit('emoji-open', $event)" />
    <div :class="resizeEdge && `md-resizable md-resizable--${resizeEdge}`" :style="resizeEdge ? { '--md-resize-height': `${displayedHeight}px` } : undefined">
      <div v-if="resizeEdge && (ready || fallback)" class="md-resize-handle" role="separator" tabindex="0"
        aria-label="调整编辑器高度" aria-orientation="horizontal" title="拖动或按上下方向键调整编辑器高度"
        :aria-valuemin="minHeight" :aria-valuemax="maxHeight" :aria-valuenow="displayedHeight"
        @pointerdown="startResize" @pointermove="moveResize" @pointerup="endResize"
        @pointercancel="endResize" @lostpointercapture="endResize" @keydown="resizeWithKeys" />
      <div class="md-input-area">
        <p v-if="instantInput && plainInput" class="md-quick-status" role="status">{{ fallback ? '格式工具暂不可用' : '格式工具加载中…' }}</p>
        <textarea
          v-if="plainInput"
          ref="fallbackInput"
          class="md-fallback"
          v-model="plainDraft"
          :aria-label="placeholder || '正文'"
          :placeholder="placeholder"
          :style="{ height: `${height}px` }"
        />
        <template v-if="!fallback">
          <div :class="{ 'md-warming-editor': plainInput }" :inert="plainInput"><div ref="host" /></div>
          <div v-if="!ready && !plainInput" class="md-loading" :style="{ height: `${height}px` }"><FpLoading small /></div>
        </template>
      </div>
    </div>
    <template v-if="!fallback">
      <div v-if="uploadStatus" class="md-upload-feedback">
        <div class="md-upload-heading">
          <strong role="status">{{ uploadStatus.text }}</strong>
          <button v-if="!uploadStatus.pending" type="button" aria-label="关闭上传进度" @click="uploadStatus = null">×</button>
        </div>
        <ul v-if="uploadStatus.items?.length" class="md-upload-files" aria-label="文件上传进度">
          <li v-for="(item, index) in uploadStatus.items" :key="index">
            <div class="md-upload-row">
              <span class="md-upload-name" :title="item.name">{{ item.name }}</span>
              <span class="md-upload-state" :data-phase="item.phase">
                {{ item.phase === 'queued' ? '等待上传' : item.phase === 'processing' ? '图床处理中' :
                  item.phase === 'done' ? '已完成' : item.phase === 'failed' ? '失败' :
                  item.phase === 'skipped' ? '未上传' : item.percent === null ? '上传中' : `${item.percent}%` }}
              </span>
            </div>
            <progress v-if="item.phase === 'uploading' || item.phase === 'processing'" :aria-label="`${item.name} 的上传进度`" :value="item.percent ?? undefined" max="100" />
            <div v-if="item.error" class="md-upload-error">{{ item.error }}</div>
          </li>
        </ul>
      </div>
      <p v-if="mentionError" role="status">{{ mentionError }}</p>
    </template>
  </div>
</template>

<style scoped>
.md-editor {
  position: relative;
}
.md-input-area { position: relative; }
.md-warming-editor { position: absolute; inset: 0 0 auto; visibility: hidden; pointer-events: none; }
.md-quick-status { margin: 0 0 6px; font-size: 12px; color: var(--fp-muted); }
.md-input-area:has(.md-quick-status) .md-fallback { display: block; font: inherit; }
.md-upload-feedback {
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-surface-subtle, var(--fp-card));
  color: var(--fp-muted);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.md-upload-heading, .md-upload-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.md-upload-heading strong { font-weight: 600; color: var(--fp-title); }
.md-upload-heading button { width: 24px; height: 24px; flex: none; padding: 0; border: 0; border-radius: 4px; background: transparent; color: inherit; font-size: 18px; line-height: 1; cursor: pointer; }
.md-upload-heading button:hover { background: var(--fp-hover); }
.md-upload-files { display: grid; gap: 6px; max-height: min(156px, 25dvh); overflow-y: auto; margin: 6px 0 0; padding: 0; list-style: none; }
.md-upload-files li + li { border-top: 1px solid var(--fp-border); padding-top: 5px; }
.md-upload-name { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--fp-text); }
.md-upload-state { flex: none; font-variant-numeric: tabular-nums; }
.md-upload-state[data-phase='done'] { color: var(--fp-primary); }
.md-upload-feedback progress { display: block; width: 100%; height: 5px; margin-top: 4px; accent-color: var(--fp-primary); }
.md-upload-error, .md-upload-state[data-phase='failed'] { color: var(--fp-danger-ink, var(--fp-danger)); }
.md-editor:has(:deep(.vditor--fullscreen)) .md-upload-feedback {
  position: fixed;
  z-index: 1000;
  inset-inline: 8px;
  bottom: max(12px, env(safe-area-inset-bottom));
  width: min(420px, calc(100% - 16px));
  border-radius: 6px;
  background: var(--fp-card);
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
  .md-editor--reply .md-resizable :deep(.vditor:not(.vditor--fullscreen)),
  .md-adaptive .md-fallback { height: auto !important; }
  .md-editor--reply .md-resizable :deep(.vditor:not(.vditor--fullscreen)) { max-height: none; }
  .md-adaptive .md-fallback { field-sizing: content; resize: none; }
  .md-adaptive :deep(.vditor:not(.vditor--fullscreen) .vditor-resize) { display: none; }
  .md-adaptive :deep(.vditor:not(.vditor--fullscreen) .vditor-content),
  .md-editor--reply .md-resizable :deep(.vditor:not(.vditor--fullscreen) .vditor-content) { flex: 0 1 auto; }
  .md-editor--reply .md-resizable :deep(.vditor:not(.vditor--fullscreen) .vditor-content [contenteditable="true"]),
  .md-adaptive :deep(.vditor:not(.vditor--fullscreen) .vditor-content [contenteditable="true"]) {
    height: auto;
    min-height: 64px;
    max-height: max(64px, 25dvh);
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
.md-resizable .md-fallback { resize: none; }
.md-resize-handle { display: none; }

@media (min-width: 768px) {
  .md-resizable { display: grid; min-width: 0; }
  .md-resizable > div { min-width: 0; }
  .md-resizable :deep(.vditor:not(.vditor--fullscreen)),
  .md-resizable :is(.md-loading, .md-fallback) { height: var(--md-resize-height) !important; }
  .md-resizable :deep(.vditor-content) { min-height: 0; }
  .md-resizable--bottom .md-resize-handle { order: 1; }
  .md-resize-handle {
    display: grid;
    place-items: center;
    height: 12px;
    border-radius: 4px;
    cursor: ns-resize;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
  }
  .md-resize-handle::before {
    content: '';
    width: 24px;
    height: 3px;
    border-radius: 2px;
    background: var(--fp-muted);
    opacity: 0.5;
  }
  .md-resize-handle:is(:hover, :focus-visible, :active) { background: var(--fp-hover); }
  .md-resizable:has(:deep(.vditor--fullscreen)) .md-resize-handle { display: none; }
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
.md-editor .vditor:not(.vditor--fullscreen) .vditor-toolbar--pin {
  top: var(--fp-nav-h);
}
.md-editor .vditor--fullscreen .vditor-toolbar--pin {
  top: 0;
}
.md-editor .vditor:focus-within {
  border-color: color-mix(in srgb, var(--fp-primary) 70%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--fp-primary) 16%, transparent);
}
.md-editor .vditor.vditor--fullscreen {
  border-radius: 0;
  background-color: var(--fp-card);
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
.md-editor .vditor-hint img.mention-avatar {
  width: 20px; height: 20px; object-fit: cover; border-radius: 4px; flex: none;
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
