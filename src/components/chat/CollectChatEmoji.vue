<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { addV3EmojiURL, emojiOperationKey } from '@/api/v3-emojis'
import { getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ html: string }>()
const auth = useAuthStore()
const mounted = ref(false)
const busy = ref(false)
const failed = ref(false)
const saved = ref(new Set<string>())
const keys = new Map<string, string>()
const identity = () => [getAuthContextVersion(), auth.account?.oId, !!auth.accessToken].join(':')
const urls = computed(() => {
  if (!mounted.value || !auth.accessToken || !auth.account?.oId || !/<img\b/i.test(props.html)) return []
  // 模板内容不会插入页面，也不会主动请求其中的图片。
  const template = document.createElement('template')
  template.innerHTML = props.html
  const images = new Set<string>()
  for (const img of template.content.querySelectorAll('img:not(.emoji)')) {
    if (img.closest('blockquote')) continue
    const src = img.getAttribute('data-src') || img.getAttribute('src')
    if (!src) continue
    try {
      const url = new URL(src, document.baseURI)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue
      // 保留绝对地址原值，避免重编码带签名的图片链接。
      images.add(/^https?:\/\//i.test(src) ? src : url.href)
    } catch {
      // 忽略无法收藏的地址。
    }
  }
  return [...images]
})
const allSaved = computed(() => urls.value.length > 0 && urls.value.every(url => saved.value.has(url)))
const label = computed(() => allSaved.value ? '已加入表情包' : busy.value ? '正在加入表情包' : failed.value ? '加入失败，点击重试' : '加入表情包')

let generation = 0
watch([identity, () => props.html], () => {
  generation++
  busy.value = false
  failed.value = false
  saved.value.clear()
  keys.clear()
}, { flush: 'sync' })

async function collect() {
  if (busy.value || allSaved.value || !urls.value.length) return
  const current = generation
  busy.value = true
  failed.value = false
  try {
    for (const url of urls.value) {
      if (saved.value.has(url)) continue
      const key = keys.get(url) ?? emojiOperationKey()
      keys.set(url, key)
      await addV3EmojiURL('', url, 0, '', key)
      if (current !== generation) return
      saved.value.add(url)
      keys.delete(url)
    }
  } catch {
    if (current === generation) failed.value = true
  } finally {
    if (current === generation) busy.value = false
  }
}

onMounted(() => { mounted.value = true })
onBeforeUnmount(() => { generation++ })
</script>

<template>
  <button
    v-if="urls.length"
    type="button"
    class="collect-emoji"
    :class="{ saved: allSaved, failed }"
    :title="label"
    :aria-label="label"
    :aria-disabled="busy || allSaved"
    :aria-busy="busy"
    @click.stop="collect"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path v-if="allSaved" d="m5 12 4 4L19 6" />
      <path v-else d="M6 4h12v16l-6-4-6 4zM9.5 9h5M12 6.5v5" />
    </svg>
  </button>
</template>

<style scoped>
.collect-emoji {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--fp-muted);
  cursor: pointer;
}
.collect-emoji svg { width: 17px; height: 17px; }
.collect-emoji:hover, .collect-emoji:focus-visible { background: var(--fp-hover); color: var(--fp-text); }
.collect-emoji.saved { color: var(--fp-primary); cursor: default; }
.collect-emoji.failed { color: #bd503c; }
</style>
