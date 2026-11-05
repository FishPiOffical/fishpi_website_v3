<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import LegacyOwnerProfileSettings from './LegacyOwnerProfileSettings.vue'
import V3OwnerProfileSettings from './V3OwnerProfileSettings.vue'
defineProps<{ mode: 'profile' | 'avatar' }>()
</script>
<template><LegacyOwnerProfileSettings v-if="getApiMode() === 'v1'" :mode="mode" /><V3OwnerProfileSettings v-else :mode="mode" /></template>
