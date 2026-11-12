<script setup lang="ts">
import { computed, useId } from 'vue'
import { storeToRefs } from 'pinia'
import { sidebarModule } from './registry'
import SidebarIcon from './SidebarIcon.vue'
import { useChatSidebarStore } from '@/stores/chatSidebar'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { useCountStore } from '@/stores/count'
import { useSettingsDrawerStore } from '@/stores/settingsDrawer'
import { useV3ChatOnlineStore } from '@/stores/v3ChatOnline'
import { avatarThumbnail, fallbackAvatar } from '@/utils/avatar'

const sidebar = useChatSidebarStore()
const { visibleModules, pref } = storeToRefs(sidebar)
const { connected, connecting, discuss, topicError } = storeToRefs(useChatStore())
const { isLoggedIn } = storeToRefs(useAuthStore())
const { view: schedule } = storeToRefs(useCountStore())
const online = useV3ChatOnlineStore()
const onlinePreview = computed(() => online.users.slice(0, 3))
const topicSummary = computed(() => topicError.value ? '暂不可用' : discuss.value || '暂无话题')
const incomeAmount = computed(() => {
  if (schedule.value?.kind === 'work') return schedule.value.earned
  if (schedule.value?.kind === 'done') return schedule.value.salary
  return null
})
const drawer = useSettingsDrawerStore()
const id = useId()
</script>

<template>
  <aside class="chat-sidebar" aria-label="聊天室侧栏">
    <header class="toolbar">
      <span class="connection" :class="{ live: connected }" role="status">
        <i aria-hidden="true" />
        {{ connected ? '实时连接' : connecting ? '连接中' : isLoggedIn ? '未连接' : '游客模式' }}
      </span>
      <button class="configure" type="button" @click="drawer.show('chatSidebar')">
        <SidebarIcon name="settings" />配置模块
      </button>
    </header>

    <section v-for="mod in visibleModules" :key="mod.id" class="card">
      <h3>
        <button
          class="card-toggle"
          type="button"
          :aria-expanded="!pref.collapsed.includes(mod.id)"
          :aria-controls="`${id}-${mod.id}`"
          @click="sidebar.toggleCollapsed(mod.id)"
        >
          <SidebarIcon class="module-icon" :name="mod.id" />
          <span class="module-title">{{ mod.title }}</span>
          <template v-if="pref.collapsed.includes(mod.id)">
            <span v-if="mod.id === 'income' && schedule" class="summary summary-accent">
              <SidebarIcon class="summary-icon" name="income" />
              <span class="summary-value">
                <template v-if="schedule.kind === 'done'">已下班</template>
                <template v-else>
                  <span class="sr-only">{{ schedule.kind === 'lunch' ? '距离午饭' : '距离下班' }} </span>{{ schedule.time }}
                </template>
              </span>
              <span v-if="incomeAmount" class="summary-income" :title="`今日已赚 ￥${incomeAmount}`">
                <span class="sr-only">今日已赚 </span>￥{{ incomeAmount }}
              </span>
            </span>
            <span v-else-if="mod.id === 'topic'" class="summary summary-accent" :title="topicSummary">
              <SidebarIcon class="summary-icon" name="topic" />
              <span class="summary-text">{{ topicSummary }}</span>
            </span>
            <span v-else-if="mod.id === 'online'" class="summary">
              <span v-if="online.total !== null" class="summary-online">
                <span v-if="onlinePreview.length" class="avatar-stack" aria-hidden="true">
                  <img v-for="user in onlinePreview" :key="user.id" :src="avatarThumbnail(user.userAvatarURL, 20)" alt="" @error="fallbackAvatar" />
                </span>
                <span class="summary-value"><span class="sr-only">本次可见 </span>{{ online.total }}<span class="sr-only"> 人</span></span>
              </span>
              <span v-else class="summary-text summary-muted">{{ !isLoggedIn ? '登录后可见' : online.loading ? '读取中' : '暂不可用' }}</span>
            </span>
          </template>
          <SidebarIcon class="chevron" name="chevron" />
        </button>
      </h3>
      <div :id="`${id}-${mod.id}`" v-show="!pref.collapsed.includes(mod.id)" class="card-body">
        <component :is="sidebarModule(mod.id)?.component" />
      </div>
    </section>
    <p v-if="!visibleModules.length" class="empty">暂未开启模块，点击「配置模块」添加。</p>
  </aside>
</template>

<style scoped>
.chat-sidebar { display: flex; flex-direction: column; gap: 10px; width: 100%; min-width: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 28px; padding: 0 2px 2px; }
.connection { display: inline-flex; align-items: center; gap: 6px; color: var(--fp-muted); font-size: 11px; }
.connection i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.connection.live i { color: var(--fp-primary); }
.configure { display: inline-flex; align-items: center; gap: 5px; padding: 4px 6px; border: 0; border-radius: 5px; background: transparent; color: var(--fp-muted); font-size: 11px; cursor: pointer; }
.configure svg { width: 14px; height: 14px; }
.configure:hover { background: var(--fp-hover); color: var(--fp-text); }
.card { min-width: 0; border: 1px solid var(--fp-border); background: var(--fp-card); box-shadow: var(--fp-card-shadow); border-radius: 8px; }
h3 { margin: 0; font-size: 12px; }
.card-toggle { display: flex; align-items: center; gap: 8px; width: 100%; padding: 12px 14px; border: 0; border-radius: 8px; background: transparent; color: var(--fp-head); font: inherit; font-weight: 600; text-align: left; cursor: pointer; }
.card-toggle:hover { color: var(--fp-title); background: var(--fp-hover); }
.card-toggle[aria-expanded='false'] { min-height: 46px; }
.module-icon { flex: none; width: 15px; height: 15px; color: var(--fp-muted); }
.module-title { flex: none; }
.chevron { flex: none; width: 14px; height: 14px; margin-left: auto; color: var(--fp-muted); transition: transform 160ms ease; }
.card-toggle[aria-expanded='false'] .chevron { transform: rotate(-90deg); }
.summary {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: min(55%, 230px);
  margin-left: auto;
  padding: 3px 8px;
  border: 1px solid var(--fp-border);
  border-radius: 999px;
  background: var(--fp-elevated);
  color: var(--fp-title);
  line-height: 1.45;
}
.summary + .chevron { margin-left: 0; }
.summary-accent {
  border-color: color-mix(in srgb, var(--fp-primary) 18%, var(--fp-border));
  background: color-mix(in srgb, var(--fp-primary) 9%, var(--fp-card));
}
.summary-icon { flex: none; width: 13px; height: 13px; color: var(--fp-primary-ink, var(--fp-primary)); }
.summary-value { flex: none; font-variant-numeric: tabular-nums; }
.summary-text, .summary-income { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.summary-income {
  padding-left: 5px;
  border-left: 1px solid var(--fp-border);
  color: var(--fp-primary-ink, var(--fp-primary));
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.summary-muted { color: var(--fp-muted); font-weight: 500; }
.summary-online, .avatar-stack { display: flex; align-items: center; gap: 5px; min-width: 0; }
.avatar-stack { gap: 0; overflow: hidden; }
.avatar-stack img {
  flex: none;
  width: 20px;
  height: 20px;
  border: 1px solid var(--fp-card);
  border-radius: 6px;
  object-fit: cover;
}
.avatar-stack img + img { margin-left: -4px; }
.avatar-stack + .summary-value { padding-left: 5px; border-left: 1px solid var(--fp-border); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.card-body { padding: 0 14px 14px; font-size: 12px; line-height: 1.6; }
.configure:focus-visible, .card-toggle:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 2px; }
.empty { margin: 0; padding: 16px; border: 1px dashed var(--fp-border); border-radius: 8px; color: var(--fp-muted); font-size: 12px; line-height: 1.6; }
@media (prefers-reduced-motion: reduce) { .chevron { transition: none; } }
</style>
