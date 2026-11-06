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
@media(max-width:900px) { .member-layout { grid-template-columns:minmax(0,1fr); } }
</style>
