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
    closable?: boolean
    /** top：人机验证等必须压在其它弹窗之上的层 */
    layer?: 'base' | 'top'
  }>(),
  { title: '', width: 420, tone: 'default', persistent: false, closable: true, layer: 'base' },
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

function onMask() {
  if (!props.persistent) close()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && !props.persistent && props.closable) close()
}

watch(
  () => props.open,
  (v) => {
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
      <div v-if="open" class="fp-dialog-mask" :class="`layer-${layer}`" @click.self="onMask">
        <div
          class="fp-dialog"
          :class="`tone-${tone}`"
          :style="{ maxWidth: `${width}px` }"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title || $slots.title ? titleId : undefined"
        >
          <header v-if="title || $slots.title || closable" class="fp-dialog-head">
            <strong :id="titleId" class="fp-dialog-title">
              <slot name="title">{{ title }}</slot>
            </strong>
            <button v-if="closable" type="button" class="fp-dialog-x" aria-label="关闭" @click="close">×</button>
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
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.5);
}
.fp-dialog-mask.layer-top {
  z-index: 1400;
}
.fp-dialog {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: calc(100vh - 40px);
  background: var(--fp-card);
  color: var(--fp-text);
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}
.fp-dialog.tone-danger {
  border-top: 3px solid var(--fp-accent);
}
.fp-dialog-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px 12px;
  border-bottom: 1px solid var(--fp-border);
}
.fp-dialog-title {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--fp-title);
}
.fp-dialog-x {
  flex: none;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--fp-muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.fp-dialog-x:hover {
  background: var(--fp-hover);
  color: var(--fp-accent);
}
.fp-dialog-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px 18px;
  font-size: 14px;
  line-height: 1.6;
}
.fp-dialog-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 18px 16px;
}

.fp-dialog-enter-active,
.fp-dialog-leave-active {
  transition: opacity 0.15s ease;
}
.fp-dialog-enter-active .fp-dialog,
.fp-dialog-leave-active .fp-dialog {
  transition: transform 0.15s ease;
}
.fp-dialog-enter-from,
.fp-dialog-leave-to {
  opacity: 0;
}
.fp-dialog-enter-from .fp-dialog,
.fp-dialog-leave-to .fp-dialog {
  transform: translateY(8px) scale(0.98);
}
</style>
