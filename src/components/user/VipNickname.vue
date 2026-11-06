<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  cachedVipName,
  loadVipName,
  vipNameClass,
  vipNameStyle,
  vipNameRevision,
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
const currentConfig = computed(() => cachedVipName(props.userId, props.userName))
let observer: IntersectionObserver | undefined
let mounted = false
function load() { if (mounted) void loadVipName(props.userId, props.userName) }

function observe() {
  observer?.disconnect()
  if (!mounted) return
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

onMounted(() => { mounted = true; observe() })
onUnmounted(() => {
  mounted = false
  observer?.disconnect()
})

watch(
  () => [props.userId, props.userName, vipNameRevision.value],
  observe,
  { flush: 'sync' },
)
</script>

<template>
  <span ref="root" :class="vipNameClass(currentConfig)" :style="vipNameStyle(currentConfig)">
    <slot>{{ text || userName }}</slot>
  </span>
</template>
