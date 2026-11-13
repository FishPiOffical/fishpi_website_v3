<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { petAnimationClip, type PetAnimationAction } from './animations'

const props = withDefaults(defineProps<{
  species: string
  image?: string
  alt: string
  action?: PetAnimationAction
  loop?: boolean
  playbackKey?: string | number
  active?: boolean
  width?: number
  height?: number
}>(), { action: 'idle', loop: true, playbackKey: 0, active: true, width: 256, height: 256 })
const emit = defineEmits<{ ended: [playbackKey: string | number] }>()
const element = ref<HTMLElement | null>(null)
const video = ref<HTMLVideoElement | null>(null)
const mounted = ref(false), capable = ref(false), intersecting = ref(false), visible = ref(false)
const reducedMotion = ref(false), saveData = ref(false), failed = ref(false), decoded = ref(false)
const loadedKey = ref('')
const clip = computed(() => petAnimationClip(props.species, props.action))
const mediaKey = computed(() => `${props.species}:${props.action}:${typeof props.playbackKey}:${props.playbackKey}`)
const staticImage = computed(() => props.image || `/images/pets/${props.species}.webp`)
const allowed = computed(() => mounted.value && capable.value && !!clip.value && !reducedMotion.value && !saveData.value && !failed.value)
const shouldPlay = computed(() => allowed.value && props.active && visible.value && intersecting.value)
const showVideo = computed(() => allowed.value && loadedKey.value === mediaKey.value)
let observer: IntersectionObserver | null = null
let motionQuery: MediaQueryList | null = null
let connection: (EventTarget & { saveData?: boolean }) | undefined
let emittedKey: string | null = null
let playAttempt = 0

function updateVisibility() { visible.value = !document.hidden }
function updatePreferences() {
  reducedMotion.value = motionQuery?.matches ?? false
  saveData.value = connection?.saveData === true
}
function releaseVideo(target: HTMLVideoElement | null) {
  if (!target) return
  target.pause()
  target.removeAttribute('src')
  target.load()
}
function currentVideo(event: Event): HTMLVideoElement | null {
  const target = event.currentTarget as HTMLVideoElement | null
  return target && target === video.value && target.dataset.mediaKey === mediaKey.value ? target : null
}
function fail(target: HTMLVideoElement) {
  if (target !== video.value || target.dataset.mediaKey !== mediaKey.value) return
  failed.value = true
  decoded.value = false
  releaseVideo(target)
}
function onData(event: Event) {
  const target = currentVideo(event)
  if (!target || !showVideo.value) return
  // 能解码 VP9 不代表能保留透明通道；首帧实际验证，避免不支持透明的浏览器出现黑底。
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 16
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context || !target.videoWidth || !target.videoHeight) return fail(target)
    context.drawImage(target, 0, 0, 16, 16)
    const pixels = context.getImageData(0, 0, 16, 16).data
    let transparent = 0, solid = 0
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index]! < 16) transparent += 1
      else if (pixels[index]! > 220) solid += 1
    }
    if (transparent < 8 || solid < 8) return fail(target)
    decoded.value = true
  } catch { fail(target) }
}
function onError(event: Event) { const target = currentVideo(event); if (target) fail(target) }
function onEnded(event: Event) {
  if (!currentVideo(event) || props.loop || emittedKey === mediaKey.value || !showVideo.value) return
  emittedKey = mediaKey.value
  emit('ended', props.playbackKey)
}
function reconcilePlayback() {
  const attempt = ++playAttempt
  const target = video.value
  if (!target) return
  if (!shouldPlay.value || (!props.loop && emittedKey === mediaKey.value)) { target.pause(); return }
  // 静音内联播放被浏览器拒绝时使用静态图，不重复弹提示或循环重试。
  try {
    const promise = target.play()
    void promise?.catch(error => {
      if (attempt !== playAttempt || target !== video.value || !shouldPlay.value || error?.name === 'AbortError') return
      fail(target)
    })
  } catch { fail(target) }
}

watch(mediaKey, () => {
  playAttempt += 1
  releaseVideo(video.value)
  failed.value = false
  decoded.value = false
  emittedKey = null
  loadedKey.value = ''
}, { flush: 'sync' })
watch([shouldPlay, mediaKey], ([value]) => { if (value) loadedKey.value = mediaKey.value }, { flush: 'sync' })
watch([video, shouldPlay], reconcilePlayback, { flush: 'post' })
watch(video, (current, previous) => {
  if (current === previous) return
  // 偏好切换也会重建同一动作的节点，新节点仍需等待透明首帧验证，不能沿用上次解码状态。
  decoded.value = false
  if (previous) releaseVideo(previous)
}, { flush: 'sync' })

onMounted(() => {
  motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null
  connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection
  motionQuery?.addEventListener('change', updatePreferences)
  connection?.addEventListener('change', updatePreferences)
  document.addEventListener('visibilitychange', updateVisibility)
  updatePreferences()
  updateVisibility()
  capable.value = document.createElement('video').canPlayType('video/webm; codecs="vp9"') !== ''
  if (typeof IntersectionObserver !== 'undefined' && element.value) {
    observer = new IntersectionObserver(entries => {
      intersecting.value = entries.some(entry => entry.target === element.value && entry.isIntersecting)
    }, { threshold: 0 })
    observer.observe(element.value)
  } else intersecting.value = true
  mounted.value = true
})
onBeforeUnmount(() => {
  mounted.value = false
  playAttempt += 1
  observer?.disconnect()
  motionQuery?.removeEventListener('change', updatePreferences)
  connection?.removeEventListener('change', updatePreferences)
  document.removeEventListener('visibilitychange', updateVisibility)
  releaseVideo(video.value)
})
</script>

<template>
  <span ref="element" class="pet-animation" :class="{ 'is-playing': shouldPlay && decoded }" :style="{ '--pet-animation-width': `${width}px`, '--pet-animation-ratio': `${width} / ${height}` }" :data-pet-action="action">
    <img :src="staticImage" :alt="alt" :width="width" :height="height" draggable="false" />
    <video v-if="showVideo && clip" :key="mediaKey" ref="video" :src="clip.src" :data-media-key="mediaKey" :width="width" :height="height" :loop="loop" preload="none" muted playsinline disablepictureinpicture tabindex="-1" aria-hidden="true" @loadeddata="onData" @error="onError" @ended="onEnded" />
  </span>
</template>

<style scoped>
.pet-animation { position: relative; display: block; flex: none; width: var(--pet-animation-width, 256px); max-width: 100%; aspect-ratio: var(--pet-animation-ratio, 1); }
.pet-animation img, .pet-animation video { display: block; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.pet-animation video { position: absolute; inset: 0; opacity: 0; }
.pet-animation.is-playing img { opacity: 0; }
.pet-animation.is-playing video { opacity: 1; }
</style>
