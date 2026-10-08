<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const root = ref<HTMLElement | null>(null)
const ready = ref(false)
let anim: { goToAndPlay: (f: number, isFrame?: boolean) => void; destroy: () => void } | null = null

function playHover() {
  anim?.goToAndPlay(10, true)
}

onMounted(async () => {
  if (!root.value || import.meta.env.SSR) return
  try {
    const [{ default: lottie }, data] = await Promise.all([
      import('lottie-web'),
      fetch('/logo-data.json').then((r) => r.json()),
    ])
    anim = lottie.loadAnimation({
      container: root.value,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      animationData: data,
    })
    // 与现网一致：入场从第 27 帧播起，悬停从第 10 帧
    anim.goToAndPlay(27, true)
    root.value.addEventListener('mouseenter', playHover)
    ready.value = true
  } catch {
    ready.value = false
  }
})

onBeforeUnmount(() => {
  root.value?.removeEventListener('mouseenter', playHover)
  anim?.destroy()
  anim = null
})
</script>

<template>
  <div class="wrap">
    <img v-show="!ready" src="/logo.png" width="48" height="48" alt="" class="fallback" />
    <div ref="root" class="logo-animate" aria-hidden="true" />
  </div>
</template>

<style scoped>
.wrap {
  position: relative;
  width: 48px;
  height: 48px;
}
.fallback {
  position: absolute;
  inset: 0;
  width: 48px;
  height: 48px;
  object-fit: contain;
}
.logo-animate {
  width: 48px;
  height: 48px;
  line-height: 0;
}
.logo-animate :deep(svg) {
  width: 48px;
  height: 48px;
  display: block;
}
</style>
