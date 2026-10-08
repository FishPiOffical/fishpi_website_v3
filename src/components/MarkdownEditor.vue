<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { searchUserNames, uploadFiles } from '@/api/fishpi'
import { useAppearanceStore } from '@/stores/appearance'

const props = withDefaults(
  defineProps<{
    modelValue: string
    apiKey?: string | null
    height?: number
    placeholder?: string
    outline?: boolean
  }>(),
  { apiKey: null, height: 500, placeholder: '', outline: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const VDITOR_CDN = 'https://file.fishpi.cn/vditor/latest/dist'

interface VditorInstance {
  getValue(): string
  setValue(value: string, clearStack?: boolean): void
  insertValue(value: string, render?: boolean): void
  setTheme(theme: 'classic' | 'dark', contentTheme?: string, codeTheme?: string, contentThemePath?: string): void
  destroy(): void
}
type VditorCtor = new (el: HTMLElement, options: Record<string, unknown>) => VditorInstance

let loader: Promise<VditorCtor> | null = null

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

onMounted(async () => {
  let Vditor: VditorCtor
  try {
    Vditor = await loadVditor()
  } catch {
    fallback.value = true
    return
  }
  if (!host.value) return
  editor = new Vditor(host.value, {
    value: props.modelValue,
    height: props.height,
    placeholder: props.placeholder,
    cache: { enable: false },
    lang: 'zh_CN',
    theme: dark.value ? 'dark' : 'classic',
    outline: { enable: props.outline, position: 'left' },
    resize: { enable: true, position: 'bottom' },
    preview: { delay: 500, mode: 'both', url: '/markdown' },
    counter: { enable: true },
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
      extend: [
        {
          key: '@',
          hint: async (key: string) => {
            if (!props.apiKey || !key) return []
            try {
              const names = await searchUserNames(props.apiKey, key)
              return names.slice(0, 8).map((n) => ({ value: `@${n} `, html: escapeHtml(n) }))
            } catch {
              return []
            }
          },
        },
      ],
    },
    input: (value: string) => {
      lastEmitted = value
      emit('update:modelValue', value)
    },
    after: () => {
      ready.value = true
      if (props.modelValue !== lastEmitted) editor?.setValue(props.modelValue, true)
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
