<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { CHAT_SIDEBAR_MODULES } from './registry'
import { useChatSidebarStore } from '@/stores/chatSidebar'

const store = useChatSidebarStore()
const { visibleModules, configuring } = storeToRefs(store)
</script>

<template>
  <aside class="side">
    <header class="toolbar">
      <strong>侧边栏</strong>
      <button type="button" @click="configuring = !configuring">{{ configuring ? '完成' : '配置模块' }}</button>
    </header>

    <div v-if="configuring" class="config">
      <p>勾选显示，上下调整顺序。模块互不耦合，后续可继续加新块。</p>
      <ul>
        <li v-for="mod in CHAT_SIDEBAR_MODULES" :key="mod.id">
          <label>
            <input type="checkbox" :checked="store.isOn(mod.id)" @change="store.toggle(mod.id)" />
            {{ mod.title }}
          </label>
          <span>
            <button type="button" @click="store.move(mod.id, -1)">上</button>
            <button type="button" @click="store.move(mod.id, 1)">下</button>
          </span>
        </li>
      </ul>
      <button type="button" class="ghost" @click="store.reset">恢复默认</button>
    </div>

    <section v-for="mod in visibleModules" :key="mod.id" class="card">
      <h3>{{ mod.title }}</h3>
      <component :is="mod.component" />
    </section>
  </aside>
</template>

<style scoped>
.side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar,
.config li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.toolbar button,
.config button {
  border: 1px solid var(--fp-border);
  background: var(--fp-hover);
  color: var(--fp-text);
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
}
.config {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  padding: 10px;
  font-size: 12px;
  color: var(--fp-muted);
}
.config ul {
  list-style: none;
  margin: 8px 0;
  padding: 0;
}
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  padding: 12px;
}
.card h3 {
  margin: 0 0 10px;
  font-size: 14px;
}
.ghost {
  width: 100%;
}
</style>
