<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ name: string; roleId?: string }>()
type RoleTone = 'admin' | 'operator' | 'discipline' | 'supermember' | 'member' | 'newcomer' | 'visitor' | 'neutral'

// 身份名称由服务端提供；固定角色 ID 仅用于视觉区分，绝不作为操作权限判断。
const roleTones: Record<string, RoleTone> = {
  adminRole: 'admin',
  '1630552921050': 'operator',
  '1630631382235': 'discipline',
  '1630553268292': 'supermember',
  memberRole: 'member',
  '1630553360689': 'member',
  regularRole: 'member',
  leaderRole: 'member',
  defaultRole: 'newcomer',
  visitorRole: 'visitor',
}
const legacyNameTones: Record<string, RoleTone> = {
  管理员: 'admin', OP: 'operator', 纪律委员: 'discipline', 超级会员: 'supermember',
  成员: 'member', 活跃成员: 'member', 新手: 'newcomer', 新手成员: 'newcomer', 游客: 'visitor',
}
// 兼容尚未返回角色 ID 的服务器；未知自定义角色保持中性色，不冒充已有等级。
const tone = computed(() => props.roleId ? roleTones[props.roleId] || 'neutral' : legacyNameTones[props.name] || 'neutral')
const icons: Partial<Record<RoleTone, string>> = {
  admin: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z M12 8v7 M9 11.5h6',
  operator: 'M14 4a5 5 0 0 0-6 6L3 15a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-3-3z',
  discipline: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z M8 12l3 3 5-6',
  supermember: 'm3 7 5 4 4-7 4 7 5-4-2 12H5z M6 16h12',
  member: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',
  newcomer: 'M12 21V11 M12 15C4 15 3 8 3 8c6 0 9 3 9 7 M12 11c0-6 4-8 9-8 0 6-4 8-9 8',
  visitor: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21a8 8 0 0 1 16 0',
}
</script>

<template>
  <span class="user-role-badge" :class="`user-role-badge--${tone}`" :title="name"><svg v-if="icons[tone]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="icons[tone]" /></svg>{{ name }}</span>
</template>

<style scoped>
.user-role-badge {
  --role-ink: #626872;
  --role-soft: #f1f3f5;
  display: inline-block;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 9em;
  padding: 1px 6px;
  border: 1px solid color-mix(in srgb, var(--role-ink) 17%, transparent);
  border-radius: 5px;
  background: var(--role-soft);
  color: var(--role-ink);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  vertical-align: middle;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-role-badge--admin { --role-ink: #394352; --role-soft: #e9edf2; }
.user-role-badge--operator { --role-ink: #a64e1d; --role-soft: #fff0e5; }
.user-role-badge--discipline { --role-ink: #2d6196; --role-soft: #eaf3fd; }
.user-role-badge--supermember { --role-ink: #896012; --role-soft: #fff5d8; }
.user-role-badge--member { --role-ink: #37734d; --role-soft: #eaf5ed; }
.user-role-badge--newcomer { --role-ink: #4e7074; --role-soft: #edf4f4; }
.user-role-badge--visitor { --role-ink: #6e7177; --role-soft: #f2f3f5; }
.user-role-badge svg { width:12px; height:12px; margin-right:3px; vertical-align:-2px; }
html[data-theme='classic-dark'] .user-role-badge { --role-ink: #c5cbd2; --role-soft: #383d43; }
html[data-theme='classic-dark'] .user-role-badge--admin { --role-ink: #e1e6ef; --role-soft: #3c4553; }
html[data-theme='classic-dark'] .user-role-badge--operator { --role-ink: #ffc18d; --role-soft: #49372c; }
html[data-theme='classic-dark'] .user-role-badge--discipline { --role-ink: #a7cfff; --role-soft: #2d3e50; }
html[data-theme='classic-dark'] .user-role-badge--supermember { --role-ink: #f2d180; --role-soft: #463e2b; }
html[data-theme='classic-dark'] .user-role-badge--member { --role-ink: #9dd4ad; --role-soft: #2f4437; }
html[data-theme='classic-dark'] .user-role-badge--newcomer { --role-ink: #afced0; --role-soft: #344245; }
html[data-theme='classic-dark'] .user-role-badge--visitor { --role-ink: #b9bdc4; --role-soft: #373a40; }
</style>
