<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fetchVditorEmoji, searchUsers, uploadFiles } from '@/api/fishpi'
import { useAppearanceStore } from '@/stores/appearance'

const props = withDefaults(
  defineProps<{
    modelValue: string
    apiKey?: string | null
    height?: number
    placeholder?: string
    outline?: boolean
    /** 精简模式：只留表情/链接/上传/编辑模式，仅编辑区不分屏预览（对齐现网私信） */
    compact?: boolean
    /** 聊天室工具栏（对齐现网 chat-room.js），同样只有编辑区 */
    chat?: boolean
    /** 启用本地草稿缓存（Vditor localStorage），值为缓存键 */
    cacheId?: string
  }>(),
  { apiKey: null, height: 500, placeholder: '', outline: false, compact: false, chat: false, cacheId: '' },
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

const COMPACT_TOOLBAR = [
  'emoji',
  'link',
  'upload',
  'edit-mode',
  { name: 'more', toolbar: ['insert-after', 'fullscreen', 'preview', 'info', 'help'] },
]

const CHAT_TOOLBAR = [
  'emoji',
  'headings',
  'bold',
  'italic',
  '|',
  'link',
  'upload',
  '|',
  'undo',
  'redo',
  '|',
  'edit-mode',
  'fullscreen',
  {
    name: 'more',
    toolbar: [
      'table',
      'list',
      'ordered-list',
      'check',
      'outdent',
      'indent',
      'quote',
      'code',
      'insert-before',
      'insert-after',
      'info',
      'help',
    ],
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
  const inline = props.compact || props.chat
  const toolbar = narrow ? COMPACT_TOOLBAR : props.chat ? CHAT_TOOLBAR : props.compact ? COMPACT_TOOLBAR : undefined
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
    ...(toolbar ? { toolbar } : {}),
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
  <div v-else class="md-editor">
    <div ref="host" />
    <p v-if="!ready" class="md-loading">编辑器加载中…</p>
  </div>
</template>

<style scoped>
.md-editor {
  position: relative;
}
.md-loading {
  margin: 0;
  padding: 12px;
  font-size: 13px;
  color: var(--fp-muted);
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
