<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fetchVditorEmoji, searchUsers, uploadFiles } from '@/api/fishpi'
import { useAppearanceStore } from '@/stores/appearance'
import FpLoading from '@/components/FpLoading.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    apiKey?: string | null
    height?: number
    placeholder?: string
    outline?: boolean
    /** reply：聊天室 / 私信 / 回帖共用的短文工具栏，仅编辑区；post：发帖的长文工具栏，分屏预览 */
    mode?: 'reply' | 'post'
    /** 启用本地草稿缓存（Vditor localStorage），值为缓存键 */
    cacheId?: string
  }>(),
  { apiKey: null, height: 500, placeholder: '', outline: false, mode: 'post', cacheId: '' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string]; submit: [] }>()

const VDITOR_CDN = 'https://file.fishpi.cn/vditor/latest/dist'

interface VditorInstance {
  focus(): void
  getValue(): string
  setValue(value: string, clearStack?: boolean): void
  insertValue(value: string, render?: boolean): void
  setTheme(theme: 'classic' | 'dark', contentTheme?: string, codeTheme?: string, contentThemePath?: string): void
  destroy(): void
}
type VditorCtor = new (el: HTMLElement, options: Record<string, unknown>) => VditorInstance

let loader: Promise<VditorCtor> | null = null
let emojiLoader: { key: string; p: Promise<Record<string, string>> } | null = null

function loadEmoji(apiKey: string | null) {
  if (!apiKey) return Promise.resolve({})
  if (emojiLoader?.key !== apiKey) {
    emojiLoader = { key: apiKey, p: fetchVditorEmoji(apiKey).catch(() => ({})) }
  }
  return emojiLoader.p
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
const fallback = ref(false)
const ready = ref(false)
let editor: VditorInstance | null = null
let lastEmitted = props.modelValue

const appearance = useAppearanceStore()
const dark = computed(() => appearance.state.theme.includes('dark'))
const CONTENT_THEME_PATH = `${VDITOR_CDN}/css/content-theme`

function applyTheme() {
  if (!editor || !ready.value) return
  editor.setTheme(dark.value ? 'dark' : 'classic', dark.value ? 'dark' : 'light', dark.value ? 'native' : 'github', CONTENT_THEME_PATH)
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

async function mentionHints(key: string) {
  if (!props.apiKey) return []
  try {
    const users = await searchUsers(props.apiKey, key)
    const rows = users.slice(0, 8).map((u) => ({
      value: `@${u.userName} `,
      html: `${u.avatar ? `<img src="${escapeHtml(u.avatar)}"/>` : ''}${escapeHtml(u.userName)}`,
    }))
    if (!key) rows.push({ value: '@participants ', html: '参与者' })
    return rows
  } catch {
    return []
  }
}

onMounted(async () => {
  let Vditor: VditorCtor
  let emoji: Record<string, string>
  try {
    ;[Vditor, emoji] = await Promise.all([loadVditor(), loadEmoji(props.apiKey)])
  } catch {
    fallback.value = true
    return
  }
  if (!host.value) return
  const narrow = window.innerWidth < 768
  const inline = props.mode === 'reply'
  const toolbar = narrow ? MOBILE_TOOLBAR : inline ? REPLY_TOOLBAR : POST_TOOLBAR
  editor = new Vditor(host.value, {
    value: props.modelValue,
    height: props.height,
    placeholder: props.placeholder,
    cache: props.cacheId ? { enable: true, id: props.cacheId } : { enable: false },
    lang: 'zh_CN',
    theme: dark.value ? 'dark' : 'classic',
    outline: { enable: props.outline, position: 'left' },
    resize: { enable: !narrow, position: 'bottom' },
    preview: { delay: 500, mode: inline ? 'editor' : 'both', url: '/markdown' },
    counter: { enable: !inline },
    toolbar,
    toolbarConfig: { pin: !inline },
    ctrlEnter: () => emit('submit'),
    upload: {
      accept: 'image/*,.zip,.rar,.7z,.mp3,.mp4,.webm,.mov',
      handler: async (files: File[]) => {
        if (!props.apiKey) return '请先登录后再上传'
        try {
          const urls = await uploadFiles(props.apiKey, files)
          const md = urls
            .map((u, i) => {
              const name = files[i]?.name || 'file'
              return files[i]?.type.startsWith('image/') ? `![${name}](${u})` : `[${name}](${u})`
            })
            .join('\n')
          editor?.insertValue(`\n${md}\n`)
          return null
        } catch (e) {
          return e instanceof Error ? e.message : '上传失败'
        }
      },
    },
    hint: {
      parse: false,
      ...(Object.keys(emoji).length ? { emoji } : {}),
      emojiTail: '<a href="/settings/function" target="_blank">设置常用表情</a>',
      extend: [{ key: '@', hint: mentionHints }],
    },
    input: (value: string) => {
      lastEmitted = value
      emit('update:modelValue', value)
    },
    after: () => {
      ready.value = true
      const cached = editor?.getValue().replace(/\n$/, '') || ''
      if (props.modelValue !== lastEmitted) editor?.setValue(props.modelValue, true)
      else if (!props.modelValue && cached.trim()) {
        lastEmitted = cached
        emit('update:modelValue', cached)
      }
      if (dark.value) applyTheme()
    },
  })
})

watch(dark, applyTheme)

watch(
  () => props.modelValue,
  (value) => {
    if (!editor || !ready.value || value === lastEmitted) return
    lastEmitted = value
    editor.setValue(value, true)
  },
)

onBeforeUnmount(() => {
  editor?.destroy()
  editor = null
})

defineExpose({
  focus() {
    editor?.focus()
  },
  insert(text: string) {
    if (editor && ready.value) editor.insertValue(text)
    else emit('update:modelValue', props.modelValue + text)
  },
})
</script>

<template>
  <textarea
    v-if="fallback"
    class="md-fallback"
    :value="modelValue"
    :placeholder="placeholder"
    :style="{ height: `${height}px` }"
    @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
  <div v-else class="md-editor" :class="`md-editor--${mode}`">
    <div ref="host" />
    <div v-if="!ready" class="md-loading" :style="{ height: `${height}px` }"><FpLoading small /></div>
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
