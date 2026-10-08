<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { HOME_MODULES } from '@/home/modules'
import { useHomeLayoutStore } from '@/stores/homeLayout'

const layout = useHomeLayoutStore()

function onDocClick(e: MouseEvent) {
  const t = e.target as HTMLElement | null
  if (!t?.closest?.('.home-personalize')) layout.panelOpen = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div class="home-personalize">
    <button
      type="button"
      class="open"
      aria-label="配置首页模块"
      :aria-expanded="layout.panelOpen"
      @click.stop="layout.panelOpen = !layout.panelOpen"
    >
      <span class="gear" aria-hidden="true">⚙</span>
      <span>配置</span>
    </button>
    <div v-if="layout.panelOpen" class="panel" role="dialog" aria-label="首页模块配置" @click.stop>
      <header class="head">
        <b>首页模块</b>
        <button type="button" class="ghost" @click="layout.panelOpen = false">关闭</button>
      </header>
      <div class="actions">
        <button type="button" @click="layout.applyPreset(6)">精简6</button>
        <button type="button" @click="layout.applyPreset(8)">标准8</button>
        <button type="button" @click="layout.reset()">重置</button>
      </div>
      <ul class="list">
        <li v-for="m in HOME_MODULES" :key="m.id">
          <label class="check">
            <input type="checkbox" :checked="!layout.isHidden(m.id)" @change="layout.toggle(m.id)" />
            <span>{{ m.title }}</span>
          </label>
          <div class="sort">
            <button type="button" aria-label="上移" @click="layout.move(m.id, -1)">↑</button>
            <button type="button" aria-label="下移" @click="layout.move(m.id, 1)">↓</button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.home-personalize {
  position: relative;
  display: flex;
  justify-content: flex-end;
  margin: 0 0 8px;
}
.open {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--fp-border);
  background: var(--fp-card);
  color: var(--fp-head);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 13px;
  cursor: pointer;
}
.open:hover {
  color: var(--fp-link);
}
.gear {
  font-size: 14px;
  line-height: 1;
}
.panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 40;
  width: min(360px, calc(100vw - 32px));
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  padding: 12px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--fp-head);
}
.ghost {
  border: 0;
  background: transparent;
  color: var(--fp-link);
  cursor: pointer;
  font-size: 12px;
}
.actions {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.actions button,
.sort button {
  border: 1px solid var(--fp-border);
  background: var(--fp-hover);
  color: var(--fp-text);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 12px;
  cursor: pointer;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow: auto;
}
.list li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}
.check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--fp-title);
  min-width: 0;
}
.sort {
  display: flex;
  gap: 4px;
}
</style>
