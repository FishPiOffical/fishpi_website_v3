<script setup lang="ts">
import { computed, ref } from 'vue'
import DragGrip from '@/components/home/DragGrip.vue'

interface ModuleOption { id: string; title: string }
type Presentation = 'card' | 'tabs'
const props = defineProps<{
  modules: ModuleOption[]
  isOn: (id: string) => boolean
  presentationOf: (id: string) => Presentation
}>()
const emit = defineEmits<{
  toggle: [id: string]
  presentation: [id: string, mode: Presentation]
  moveTo: [id: string, targetId: string, after: boolean]
}>()
const draggedId = ref('')
const overId = ref('')
// 资料卡固定置顶；排序按钮与拖动只作用于其余模块。
const items = computed(() => [
  ...props.modules.filter(module => module.id === 'profile'),
  ...props.modules.filter(module => module.id !== 'profile'),
])
const movableIds = computed(() => items.value.filter(module => module.id !== 'profile').map(module => module.id))
function move(id: string, direction: -1 | 1) {
  const index = movableIds.value.indexOf(id)
  const target = movableIds.value[index + direction]
  if (target) emit('moveTo', id, target, direction === 1)
}
function startDrag(event: DragEvent, id: string) {
  draggedId.value = id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }
}
function dragOver(event: DragEvent, id: string) {
  if (!draggedId.value || id === 'profile') return
  event.preventDefault()
  overId.value = id
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}
function endDrag() { draggedId.value = ''; overId.value = '' }
function drop(event: DragEvent, id: string) {
  if (!draggedId.value || id === 'profile') return
  event.preventDefault()
  const row = event.currentTarget as HTMLElement
  emit('moveTo', draggedId.value, id, event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2)
  endDrag()
}
</script>

<template>
  <ul class="module-settings-list">
    <li
      v-for="module in items" :key="module.id" :data-module-id="module.id"
      :class="{ 'is-off': !isOn(module.id), 'is-dragging': draggedId === module.id, 'is-drop-target': overId === module.id }"
      @dragover="dragOver($event, module.id)" @drop="drop($event, module.id)"
    >
      <div class="module-setting-top">
        <label class="module-toggle">
          <input type="checkbox" :checked="isOn(module.id)" @change="emit('toggle', module.id)" />
          <span>{{ module.title }}</span>
        </label>
        <span v-if="module.id === 'profile'" class="fixed-note">独立置顶</span>
        <div v-else class="module-sort">
          <button type="button" :aria-label="`上移${module.title}`" :disabled="movableIds[0] === module.id" @click="move(module.id, -1)">↑</button>
          <button type="button" :aria-label="`下移${module.title}`" :disabled="movableIds[movableIds.length - 1] === module.id" @click="move(module.id, 1)">↓</button>
          <span class="module-drag" draggable="true" :title="`拖动排序：${module.title}`" @dragstart="startDrag($event, module.id)" @dragend="endDrag"><DragGrip /></span>
        </div>
      </div>
      <div v-if="module.id !== 'profile'" class="module-placement">
        <span class="placement-label">显示位置</span>
        <div class="placement-options" role="group" :aria-label="`${module.title}显示位置`">
          <button type="button" :aria-pressed="presentationOf(module.id) === 'card'" @click="emit('presentation', module.id, 'card')">独立卡片</button>
          <button type="button" :aria-pressed="presentationOf(module.id) === 'tabs'" @click="emit('presentation', module.id, 'tabs')">标签页</button>
        </div>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.module-settings-list { display: flex; flex-direction: column; gap: 8px; padding: 0; margin: 0; list-style: none; }
.module-settings-list li { padding: 12px 14px; border: 1px solid var(--fp-border); border-radius: 10px; background: var(--fp-card); transition: border-color 150ms, background 150ms; }
.module-settings-list li.is-off { background: color-mix(in srgb, var(--fp-hover) 60%, var(--fp-card)); }
.module-settings-list li.is-off .module-toggle span { color: var(--fp-muted); }
.module-setting-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 26px; }
.module-toggle { display: inline-flex; gap: 9px; align-items: center; min-width: 0; color: var(--fp-title); font-size: 13px; font-weight: 550; cursor: pointer; }
.module-toggle input { width: 15px; height: 15px; flex: none; margin: 0; accent-color: var(--fp-primary); }
.fixed-note, .placement-label { font-size: 11px; color: var(--fp-muted); }
.fixed-note { white-space: nowrap; }
.module-sort { display: flex; flex: none; align-items: center; gap: 2px; }
.module-sort button { display: grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 5px; color: var(--fp-muted); background: transparent; cursor: pointer; }
.module-sort button:disabled { opacity: .35; cursor: default; }
.module-sort button:not(:disabled):hover { color: var(--fp-title); background: var(--fp-hover); }
.module-drag { display: grid; place-items: center; width: 24px; height: 26px; color: var(--fp-muted); cursor: grab; }
.module-drag :deep(svg) { width: 16px; height: 16px; }
.module-placement { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; padding-left: 24px; }
.placement-options { display: inline-flex; padding: 2px; border: 1px solid var(--fp-border); border-radius: 7px; background: var(--fp-hover); }
.placement-options button { padding: 4px 10px; border: 0; border-radius: 5px; background: transparent; color: var(--fp-muted); font: inherit; font-size: 11px; white-space: nowrap; cursor: pointer; }
.placement-options button[aria-pressed="true"] { background: var(--fp-card); color: var(--fp-primary); box-shadow: 0 1px 3px #0000000d; font-weight: 600; }
.placement-options button:hover { color: var(--fp-primary); }
button:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 2px; }
.is-dragging { opacity: .45; }
.module-settings-list li.is-drop-target { outline: 2px solid var(--fp-primary); outline-offset: 1px; }
@media (max-width: 380px) { .module-settings-list li { padding: 10px; }.module-placement { padding-left: 0; } }
@media (prefers-reduced-motion: reduce) { .module-settings-list li { transition: none; } }
</style>
