<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ animate?: boolean }>()
const root = ref<HTMLElement | null>(null)
let motion: Animation | undefined
onMounted(() => {
  const el = root.value
  if (!el || !props.animate || !el.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  // 展开真实布局高度，让后续消息逐帧让位；结束后恢复自然高度以容纳延迟加载的图片。
  motion = el.animate([
    { height: '0px', opacity: 0, transform: 'translateY(-8px)', marginBottom: '-12px', overflow: 'hidden' },
    { height: `${el.getBoundingClientRect().height}px`, opacity: 1, transform: 'translateY(0)', marginBottom: '0px', overflow: 'hidden' },
  ], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' })
})
onBeforeUnmount(() => motion?.cancel())
</script>

<template><div ref="root" class="chat-message-entry"><slot /></div></template>

<style scoped>
.chat-message-entry { min-width: 0; flex-shrink: 0; display: flow-root; }
</style>
