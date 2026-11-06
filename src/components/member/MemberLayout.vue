<script setup lang="ts">
import { computed, provide } from 'vue'
import { useRoute } from 'vue-router'
import { MEMBER_PROFILE_KEY, useMemberProfile } from '@/composables/useMemberProfile'
import MemberProfileCard from './MemberProfileCard.vue'
import MemberTabs from './MemberTabs.vue'

const route = useRoute()
const userName = computed(() => String(route.params.userName || ''))
const profileState = useMemberProfile(userName)
const { profile, profileLoading, profileError, readProfile } = profileState
provide(MEMBER_PROFILE_KEY, profileState)
</script>
<template>
  <div class="member-layout fp-page fp-page--wide fp-ui">
    <MemberProfileCard :profile="profile" :loading="profileLoading" :error="profileError" @retry="readProfile" />
    <div class="member-main"><MemberTabs /><slot /></div>
  </div>
</template>
<style scoped>
.member-layout { display:grid; grid-template-columns:280px minmax(0,1fr); align-items:start; gap:var(--fp-page-gap,18px); }
.member-main { min-width:0; }
.member-main :deep(.fp-page) { width:100%; max-width:none; margin:0; }
.member-main :deep(.fp-surface), .member-main :deep(.public-medals) { padding:20px 24px; }
.member-main :deep(.fp-state), .member-main :deep(.member-status) { padding:28px 16px; font-size:13px; }
.member-main :deep(.fp-pagination), .member-main :deep(.medal-pager), .member-main :deep(.user-relations > nav), .member-main :deep(.saved-content > nav), .member-main :deep(.anonymous-content nav) { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:10px; padding-top:16px; margin-top:20px; border-top:1px solid var(--fp-divider); font-size:12px; color:var(--fp-muted); }
.member-main :deep(.user-relations > ul) { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.member-main :deep(.user-relations > ul > li) { padding:14px; border:1px solid var(--fp-divider); border-radius:10px; min-width:0; }
.member-main :deep(.user-relations > ul > li > span) { color:var(--fp-muted); font-size:12px; }
.member-main :deep(.saved-content .tags) { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.member-main :deep(.saved-content .tags li) { padding:14px; border:1px solid var(--fp-divider); border-radius:10px; }
@media(max-width:900px) { .member-layout { grid-template-columns:minmax(0,1fr); } }
@media(max-width:640px) { .member-main :deep(.fp-surface), .member-main :deep(.public-medals) { padding:16px; } .member-main :deep(.user-relations > ul), .member-main :deep(.saved-content .tags) { grid-template-columns:minmax(0,1fr); } }
</style>
