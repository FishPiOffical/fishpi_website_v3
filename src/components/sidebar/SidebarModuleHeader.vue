<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import SidebarIcon from '@/chat/sidebar/SidebarIcon.vue'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { useAppearanceStore } from '@/stores/appearance'
import { useCountStore } from '@/stores/count'
import { useV3ChatOnlineStore } from '@/stores/v3ChatOnline'
import { useV3ChatMutesStore } from '@/stores/v3ChatMutes'
import { findPack } from '@/packs'
import { avatarThumbnail, avatarUrl, fallbackAvatar } from '@/utils/avatar'
import type { ChatSidebarModuleId } from '@/chat/sidebar/meta'

const props = withDefaults(defineProps<{
  moduleId: ChatSidebarModuleId | 'checkin' | 'download'
  title: string
  expanded: boolean
  controls: string
  summary?: string
  heading?: 'h2' | 'h3'
  disabled?: boolean
}>(), { heading: 'h3' })
const emit = defineEmits<{ toggle: [] }>()
const { isLoggedIn, account } = storeToRefs(useAuthStore())
const { view: schedule } = storeToRefs(useCountStore())
const online = props.moduleId === 'online' ? useV3ChatOnlineStore() : null
const mutes = props.moduleId === 'mutes' ? useV3ChatMutesStore() : null
const chat = props.moduleId === 'topic' ? useChatStore() : null
const appearance = useAppearanceStore()
const theme = computed(() => findPack('theme', appearance.state.theme))
const profile = computed(() => isLoggedIn.value ? account.value : null)
const onlinePreview = computed(() => online?.users.slice(0, 3) ?? [])
const topicSummary = computed(() => chat?.topicError ? '暂不可用' : chat?.discuss || '暂无话题')
const incomeAmount = computed(() => {
  if (schedule.value?.kind === 'work') return schedule.value.earned
  if (schedule.value?.kind === 'done') return schedule.value.salary
  return null
})
const summaryText = computed(() => {
  switch (props.moduleId) {
    case 'activity':
    case 'checkin': return isLoggedIn.value ? props.summary ?? '读取中' : '登录后可见'
    case 'ad': return '暂无广告'
    case 'appearance': return theme.value?.name
    case 'breezemoons': return props.summary ?? '读取中'
    case 'download': return '摸鱼派客户端'
    case 'income': return '计算中'
    case 'mutes':
      if (!isLoggedIn.value) return '登录后可见'
      if (mutes?.loading) return '读取中'
      if (mutes?.total == null) return '暂不可用'
      return mutes.total === 0 ? '暂无禁言' : `${mutes.total} 人禁言中`
    case 'profile': return profile.value?.userNickname || profile.value?.userName || '登录后可见'
  }
})
</script>

<template>
  <component :is="heading" class="sidebar-module-heading">
    <button
      class="card-toggle"
      type="button"
      :aria-expanded="expanded"
      :aria-controls="controls"
      :disabled="disabled"
      @click="emit('toggle')"
    >
      <SidebarIcon class="module-icon" :name="moduleId" />
      <span class="module-title">{{ title }}</span>
      <template v-if="!expanded">
        <span v-if="moduleId === 'income' && schedule" class="summary summary-accent">
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
        <span v-else-if="moduleId === 'topic'" class="summary summary-accent" :title="topicSummary">
          <SidebarIcon class="summary-icon" name="topic" />
          <span class="summary-text">{{ topicSummary }}</span>
        </span>
        <span v-else-if="moduleId === 'online'" class="summary">
          <span v-if="online?.total != null" class="summary-online">
            <span v-if="onlinePreview.length" class="avatar-stack" aria-hidden="true">
              <img v-for="user in onlinePreview" :key="user.id" :src="avatarThumbnail(user.userAvatarURL, 20)" alt="" @error="fallbackAvatar" />
            </span>
            <span class="summary-value"><span class="sr-only">本次可见 </span>{{ online?.total }}<span class="sr-only"> 人</span></span>
          </span>
          <span v-else class="summary-text summary-muted">{{ !isLoggedIn ? '登录后可见' : online?.loading ? '读取中' : '暂不可用' }}</span>
        </span>
        <span v-else-if="summaryText" class="summary" :class="{ 'summary-accent': (moduleId === 'activity' || moduleId === 'checkin') && isLoggedIn }" :title="summaryText">
          <img v-if="moduleId === 'profile' && profile" class="summary-avatar" :src="avatarThumbnail(avatarUrl(profile), 20)" alt="" @error="fallbackAvatar" />
          <span v-if="moduleId === 'appearance' && theme" class="theme-swatch" :style="{ background: theme.preview }" aria-hidden="true" />
          <span class="summary-text">{{ summaryText }}</span>
        </span>
      </template>
      <SidebarIcon class="chevron" name="chevron" />
    </button>
  </component>
</template>

<style scoped>
.sidebar-module-heading { flex: 1; min-width: 0; margin: 0; font-size: 12px; }
.card-toggle { display: flex; align-items: center; gap: 8px; width: 100%; padding: 12px 14px; border: 0; border-radius: 8px; background: transparent; color: var(--fp-head); font: inherit; font-weight: 600; text-align: left; cursor: pointer; }
.card-toggle:hover { color: var(--fp-title); background: var(--fp-hover); }
.card-toggle[aria-expanded='false'] { min-height: 46px; }
.module-icon { flex: none; width: 15px; height: 15px; color: var(--fp-muted); }
.module-title { flex: none; }
.card-toggle:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: -2px; }
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
.avatar-stack img, .summary-avatar {
  flex: none;
  width: 20px;
  height: 20px;
  border: 1px solid var(--fp-card);
  border-radius: 6px;
  object-fit: cover;
}
.avatar-stack img + img { margin-left: -4px; }
.avatar-stack + .summary-value { padding-left: 5px; border-left: 1px solid var(--fp-border); }
.theme-swatch { flex: none; width: 13px; height: 13px; border: 1px solid var(--fp-border); border-radius: 4px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .chevron { transition: none; } }
</style>
