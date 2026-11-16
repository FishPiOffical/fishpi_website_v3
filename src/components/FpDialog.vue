<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    /** 面板最大宽度（px） */
    width?: number
    /** danger：顶部强调色条，用于公告/警示类 */
    tone?: 'default' | 'danger'
    /** 为 true 时点遮罩、按 Esc 都不关闭，只能点按钮 */
    persistent?: boolean
    /** 为 false 时点遮罩不关闭，Esc 和关闭按钮仍按原规则处理。 */
    closeOnBackdrop?: boolean
    closable?: boolean
    /** 内容区域自带间距，保留统一的标题、滚动容器与遮罩。 */
    flush?: boolean
    /** top：人机验证等必须压在其它弹窗之上的层 */
    layer?: 'base' | 'top'
  }>(),
  { title: '', width: 420, tone: 'default', persistent: false, closeOnBackdrop: true, closable: true, layer: 'base' },
)

const emit = defineEmits<{ 'update:open': [value: boolean]; close: [] }>()

const titleId = useId()
/** SSR 不输出 body 级 Teleport，否则水合时会和 #app 外的节点对不上 */
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

function close() {
  emit('update:open', false)
  emit('close')
}

let pointerStartedOnMask = false
function onPointerDown(event: PointerEvent) {
  pointerStartedOnMask = event.target === event.currentTarget && event.isPrimary && event.button === 0
}
function onPointerUp(event: PointerEvent) {
  if (event.target !== event.currentTarget) pointerStartedOnMask = false
}

function onMask() {
  const shouldClose = pointerStartedOnMask
  pointerStartedOnMask = false
  if (shouldClose && props.closeOnBackdrop && !props.persistent) close()
}

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented || !props.open) return
  const dialogs = Array.from(document.querySelectorAll('.fp-dialog-mask:not(.fp-dialog-leave-active)'))
  const top = dialogs.filter(node => node.classList.contains('layer-top')).at(-1) ?? dialogs.at(-1)
  if (top !== mask.value) return
  if (!props.persistent && props.closable) close()
  e.preventDefault()
}

const mask = ref<HTMLElement | null>(null)

watch(
  () => props.open,
  (v) => {
    pointerStartedOnMask = false
    if (typeof window === 'undefined') return
    if (v) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <Transition name="fp-dialog">
      <div v-if="open" ref="mask" class="fp-dialog-mask" :class="`layer-${layer}`" @pointerdown="onPointerDown" @pointerup="onPointerUp" @pointercancel="pointerStartedOnMask = false" @click.self="onMask">
        <div
          class="fp-dialog"
          :class="[`tone-${tone}`, { 'fp-dialog--flush': flush }]"
          :style="{ maxWidth: `${width}px` }"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title || $slots.title ? titleId : undefined"
        >
          <header v-if="title || $slots.title || closable" class="fp-dialog-head">
            <h2 :id="titleId" class="fp-dialog-title">
              <slot name="title">{{ title }}</slot>
            </h2>
            <button v-if="closable" type="button" class="fp-dialog-x" aria-label="关闭" @click="close">✕</button>
          </header>
          <div class="fp-dialog-body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="fp-dialog-foot">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fp-dialog-mask {
  --dialog-edge: 20px;
  --dialog-top: max(var(--dialog-edge), env(safe-area-inset-top));
  --dialog-bottom: max(var(--dialog-edge), env(safe-area-inset-bottom));
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--dialog-top) max(var(--dialog-edge), env(safe-area-inset-right))
    var(--dialog-bottom) max(var(--dialog-edge), env(safe-area-inset-left));
  background: var(--fp-mask-bg, rgba(0, 0, 0, 0.55));
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.fp-dialog-mask.layer-top {
  z-index: 1400;
}
.fp-dialog {
  --dialog-inset: var(--fp-panel-padding, 20px);
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: calc(100vh - var(--dialog-top) - var(--dialog-bottom));
  max-height: calc(100dvh - var(--dialog-top) - var(--dialog-bottom));
  background: var(--fp-card);
  color: var(--fp-text);
  border: 1px solid var(--fp-border-strong, var(--fp-border));
  border-radius: var(--fp-radius-xl, 14px);
  box-shadow: var(--fp-dialog-shadow, 0 18px 48px rgba(0, 0, 0, 0.42));
  overflow: hidden;
}
.fp-dialog.tone-danger {
  border-top: 3px solid var(--fp-danger, var(--fp-accent));
}
.fp-dialog-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px var(--dialog-inset);
  border-bottom: 1px solid var(--fp-border);
}
.fp-dialog-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 1rem;
  font-weight: 650;
  line-height: 1.4;
  overflow-wrap: anywhere;
  color: var(--fp-title);
}
.fp-dialog-x {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: var(--fp-radius-sm, 6px);
  background: transparent;
  color: var(--fp-muted);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.16s ease, color 0.16s ease;
}
.fp-dialog-x:hover {
  background: var(--fp-hover);
  color: var(--fp-title);
}
.fp-dialog-x:focus-visible {
  outline: 2px solid var(--fp-primary);
  outline-offset: -2px;
}
.fp-dialog-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 16px var(--dialog-inset);
  font-size: 14px;
  line-height: 1.6;
}
.fp-dialog--flush .fp-dialog-body {
  padding: 0;
}
.fp-dialog-foot {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px var(--dialog-inset);
  border-top: 1px solid var(--fp-border);
}
@media (max-width: 640px) {
  .fp-dialog-mask { --dialog-edge: 12px; }
  .fp-dialog-head { padding-block: 6px; }
}
@media (pointer: coarse) {
  .fp-dialog-x { width: 44px; height: 44px; }
  .fp-dialog-foot :deep(:is(button, a)) { min-height: 44px; }
}

.fp-dialog-enter-active,
.fp-dialog-leave-active {
  transition: opacity 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.fp-dialog-enter-active .fp-dialog,
.fp-dialog-leave-active .fp-dialog {
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.fp-dialog-enter-from,
.fp-dialog-leave-to {
  opacity: 0;
}
.fp-dialog-enter-from .fp-dialog,
.fp-dialog-leave-to .fp-dialog {
  transform: translateY(10px) scale(0.97);
}
@media (prefers-reduced-motion: reduce) {
  .fp-dialog-enter-active, .fp-dialog-leave-active,
  .fp-dialog-enter-active .fp-dialog, .fp-dialog-leave-active .fp-dialog {
    transition: none;
  }
}
</style>
