<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useCountStore } from '@/stores/count'
import { useChatSidebarStore } from '@/stores/chatSidebar'
import { useSettingsDrawerStore } from '@/stores/settingsDrawer'

const { loaded, view } = storeToRefs(useCountStore())
const sidebar = useChatSidebarStore()
const drawer = useSettingsDrawerStore()

function openSettings() {
  drawer.show(sidebar.isOn('income') ? 'income' : 'chatSidebar')
}
</script>

<template>
  <button
    type="button"
    class="income"
    :title="sidebar.isOn('income') ? '点击设置上下班时间' : '请先在聊天室侧栏设置中启用上下班时间'"
    @click="openSettings"
  >
    <template v-if="!loaded">
      <span class="label">上下班时间</span>
      <span class="time">--:--:--</span>
    </template>
    <template v-else-if="!view">
      <span class="label">上下班时间</span>
      <span class="sub">正在计算…</span>
    </template>
    <template v-else-if="view.kind === 'lunch'">
      <span class="label">🍲 距离午饭</span>
      <span class="time">{{ view.time }}</span>
    </template>
    <template v-else-if="view.kind === 'work'">
      <span class="label">🧑‍💻 距离下班</span>
      <span class="time">{{ view.time }}</span>
      <span v-if="view.earned" class="money">今日已赚 ￥{{ view.earned }}</span>
    </template>
    <template v-else>
      <span class="label">🎉 {{ view.salary ? '下班啦，今天赚了' : '下班时间到' }}</span>
      <span v-if="view.salary" class="money big">￥{{ view.salary }}</span>
    </template>
  </button>
</template>

<style scoped>
.income {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--fp-text);
  text-align: left;
  cursor: pointer;
}
.label {
  font-size: 12px;
  color: var(--fp-muted);
}
.time {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--fp-title);
  font-variant-numeric: tabular-nums;
}
.money {
  font-size: 13px;
  font-weight: 600;
  color: var(--fp-income);
  font-variant-numeric: tabular-nums;
}
.money.big {
  font-size: 20px;
}
.sub {
  font-size: 12px;
  color: var(--fp-link);
}
</style>
