<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import {
  cachedVipName,
  loadVipName,
  vipNameClass,
  vipNameStyle,
  type VipNameConfig,
} from '@/composables/useVipNickname'

const props = withDefaults(
  defineProps<{
    userId?: string | number
    userName?: string
    text?: string
    /** 非首屏或很长的名单可关闭自动加载，仅使用已有缓存。 */
    lazy?: boolean
  }>(),
  { userId: '', userName: '', text: '', lazy: true },
)

const root = ref<HTMLElement | null>(null)
const config = ref<VipNameConfig>()
let observer: IntersectionObserver | undefined
let token = 0

async function load() {
  const id = ++token
  const cached = cachedVipName(props.userId, props.userName)
  if (cached) {
    config.value = cached
    return
  }
  const value = await loadVipName(props.userId, props.userName)
  if (id === token) config.value = value
}

function observe() {
  observer?.disconnect()
  if (!props.lazy || typeof IntersectionObserver === 'undefined') {
    void load()
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer?.disconnect()
      void load()
    },
    { rootMargin: '180px' },
  )
  if (root.value) observer.observe(root.value)
}

onMounted(observe)
onUnmounted(() => {
  token++
  observer?.disconnect()
})

watch(
  () => [props.userId, props.userName],
  () => {
    config.value = cachedVipName(props.userId, props.userName)
    observe()
  },
)
</script>

<template>
  <span ref="root" :class="vipNameClass(config)" :style="vipNameStyle(config)">
    <slot>{{ text || userName }}</slot>
  </span>
</template>
