<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyUserFollowButton from './LegacyUserFollowButton.vue'
import V3UserFollowButton from './V3UserFollowButton.vue'
defineProps<{userName:string;userId?:string}>()
</script>
<template><LegacyUserFollowButton v-if="getApiMode()==='v1'" :user-name="userName" :user-id="userId"/><V3UserFollowButton v-else :user-name="userName" :user-id="userId"/></template>
