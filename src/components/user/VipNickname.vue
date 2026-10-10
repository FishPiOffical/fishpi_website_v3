<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
    /** 在昵称接近可视区域时加载会员配置。 */
    lazy?: boolean
  }>(),
  { userId: '', userName: '', text: '', lazy: true },
)

const root = ref<HTMLElement | null>(null)
const config = ref<VipNameConfig>()
const currentConfig = computed(() => cachedVipName(props.userId, props.userName) || config.value)
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
    token++
    config.value = cachedVipName(props.userId, props.userName)
    observe()
  },
)

watch(
  () => cachedVipName(props.userId, props.userName),
  (value, previous) => {
    if (!value && previous) void load()
  },
)
</script>

<template>
  <span ref="root" :class="vipNameClass(currentConfig)" :style="vipNameStyle(currentConfig)">
    <slot>{{ text || userName }}</slot>
  </span>
</template>
