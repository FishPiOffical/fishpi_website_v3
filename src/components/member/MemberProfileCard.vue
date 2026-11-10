<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { PublicUser } from '@/api/v3-public-user'
import { useAuthStore } from '@/stores/auth'
import { avatarStyle, avatarUrl, DEFAULT_AVATAR, avatarThumbnail } from '@/utils/avatar'
import MemberProfileBadges from './MemberProfileBadges.vue'
import VipNickname from '@/components/user/VipNickname.vue'
import UserFollowButton from '@/components/user/UserFollowButton.vue'
import ReportDialog from '@/components/ReportDialog.vue'
import PointTransfer from '@/components/settings/PointTransfer.vue'

const props = defineProps<{ profile: PublicUser | null; fromCache?: boolean; loading: boolean; error: string }>()
defineEmits<{ retry: [] }>()
const auth = useAuthStore(), mounted = ref(false), showTransfer = ref(false)
const self = computed(() => mounted.value && !!props.profile && auth.account?.oId === props.profile.id)
const canAct = computed(() => mounted.value && auth.isLoggedIn && !props.fromCache)
const points = computed(() => props.profile?.userPoint ?? null)
const onlineTime = computed(() => {
  const minutes = props.profile?.onlineMinute
  if (minutes === undefined) return '—'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor(minutes % 1440 / 60)
  if (days) return `${days}天 ${hours}小时`
  if (hours) return `${hours}小时 ${minutes % 60}分`
  return `${minutes}分钟`
})
const websiteLabel = computed(() => props.profile?.userURL ? new URL(props.profile.userURL).hostname : '')
watch([() => props.profile?.id, () => auth.account?.oId, () => auth.accessToken], () => { showTransfer.value = false })
onMounted(() => { mounted.value = true })
function fallback(event: Event) {
  const image = event.currentTarget as HTMLImageElement
  if (image.getAttribute('src') !== DEFAULT_AVATAR) image.src = DEFAULT_AVATAR
}
</script>
<template>
  <aside class="member-profile" aria-label="个人资料">
    <p v-if="loading" role="status" class="profile-status">正在读取用户资料…</p>
    <div v-if="error" role="alert" class="profile-status"><p>{{ error }}</p><button type="button" @click="$emit('retry')">重试用户资料</button></div>
    <template v-if="profile">
      <div class="profile-cover" :class="{ 'has-background': profile.cardBg }" :style="profile.cardBg ? avatarStyle(profile.cardBg) : avatarStyle(avatarUrl(profile, 'large'), 256)" aria-hidden="true" />
      <div class="profile-body">
        <img :key="profile.userAvatarURL" class="member-avatar" :src="avatarThumbnail(avatarUrl(profile, 'large'), 80)" :data-user-card="profile.userName" alt="" @error="fallback" />
        <h1><VipNickname :user-id="profile.id" :user-name="profile.userName" :text="profile.userNickname || profile.userName" /></h1>
        <p class="profile-handle">@{{ profile.userName }}</p>
        <MemberProfileBadges :key="profile.id" :user-name="profile.userName" />
        <p v-if="profile.userIntro" class="profile-intro">{{ profile.userIntro }}</p>
        <a v-if="profile.userURL" :href="profile.userURL" class="profile-website" target="_blank" rel="noopener noreferrer" :title="profile.userURL"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2" /></svg><span>{{ websiteLabel }}</span><span aria-hidden="true">↗</span></a>
        <dl class="profile-stats">
          <div><dt>积分</dt><dd>{{ points === null ? '—' : points?.toLocaleString() }}</dd></div>
          <div :title="profile.onlineMinute === undefined ? undefined : `累计 ${profile.onlineMinute.toLocaleString()} 分钟`"><dt>在线时长</dt><dd>{{ onlineTime }}</dd></div>
        </dl>
        <template v-if="canAct">
          <RouterLink v-if="self" to="/settings" class="profile-edit">编辑资料</RouterLink>
          <template v-else>
            <div class="profile-actions">
              <UserFollowButton :user-name="profile.userName" :user-id="profile.id" />
              <RouterLink :to="`/chat?toUser=${encodeURIComponent(profile.userName)}`" class="profile-message"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 4h16v12H9l-5 4z" /></svg>发私信</RouterLink>
            </div>
            <div class="profile-utilities">
              <button type="button" :aria-expanded="showTransfer" @click="showTransfer = !showTransfer">积分转账</button>
              <span aria-hidden="true">·</span>
              <ReportDialog :data-id="profile.id" :data-type="2" />
            </div>
            <PointTransfer v-if="showTransfer" :initial-recipient="profile.userName" />
          </template>
        </template>
      </div>
    </template>
  </aside>
</template>
<style scoped lang="scss">
.member-profile {  overflow:hidden; min-width:0; border:1px solid var(--fp-border); border-radius:12px; background:var(--fp-card); box-shadow:var(--fp-card-shadow); overflow-wrap:anywhere; }
.profile-cover { height:112px; background-size:cover; background-position:center 38%; position:relative; &::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,.06),color-mix(in srgb,var(--fp-card) 45%,transparent) 75%,var(--fp-card)); backdrop-filter:blur(3px); } }
.profile-cover.has-background::after { background:linear-gradient(180deg,transparent 65%,rgba(0,0,0,.08)); backdrop-filter:none; }
.profile-body { position:relative; padding:0 20px 18px; text-align:center; }
.member-avatar { display:block; position:relative; width:80px; height:80px; margin:-40px auto 12px; border:4px solid var(--fp-card); border-radius:var(--fp-avatar-radius); object-fit:cover; box-shadow:0 4px 14px rgba(0,0,0,.1); }
h1 { margin:0; color:var(--fp-title); font-size:20px; line-height:1.4; font-weight:650; }
.profile-handle { margin:4px 0 0; color:var(--fp-muted); font-size:12px; }
.profile-intro { margin:14px 0 0; font-size:13px; line-height:1.65; color:var(--fp-text); white-space:pre-wrap; }
.profile-website { display:flex; align-items:center; justify-content:center; gap:6px; max-width:100%; width:fit-content; margin:12px auto 0; color:var(--fp-muted); font-size:12px; text-decoration:none; svg { flex:none; width:13px; height:13px; } span:first-of-type { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } &:hover { text-decoration:underline; text-underline-offset:3px; } }
.profile-stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin:18px 0 14px; padding:13px 0; border-top:1px solid var(--fp-border); border-bottom:1px solid var(--fp-border); div+div { border-left:1px solid var(--fp-border); } dt { color:var(--fp-muted); font-size:11px; } dd { margin:5px 0 0; color:var(--fp-title); font-size:15px; font-weight:600; font-variant-numeric:tabular-nums; } }
.profile-actions { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); align-items:start; gap:8px; }
.profile-message,.profile-edit,:deep(.user-follow-action > button) { box-sizing:border-box; display:flex; align-items:center; justify-content:center; gap:6px; min-height:34px; width:100%; padding:7px 9px; border:1px solid var(--fp-border); border-radius:7px; background:var(--fp-card); color:var(--fp-text); font:inherit; font-size:12px; line-height:1.5; text-decoration:none; cursor:pointer; &:hover { background:var(--fp-hover); } }
:deep(.user-follow-action) { display:flex; min-width:0; font-size:11px; }
:deep(.user-follow-action > button) { background:var(--fp-primary-soft); border-color:transparent; color:var(--fp-primary); }
.profile-message svg { width:14px; height:14px; }
.profile-utilities { display:flex; align-items:center; justify-content:center; gap:10px; margin-top:10px; color:var(--fp-muted); button,:deep(.report-trigger) { min-height:26px; height:auto; margin:0; padding:3px 4px; border:0; border-radius:4px; background:transparent; color:var(--fp-muted); font:inherit; font-size:11px; line-height:1.5; cursor:pointer; &:hover { background:var(--fp-hover); text-decoration:underline; } } }
.profile-status { margin:0; padding:20px 16px; color:var(--fp-muted); font-size:13px; text-align:center; }
[role='alert'] { color:var(--fp-danger); }
@media(max-width:900px) { .member-profile { position:static; } }
</style>
