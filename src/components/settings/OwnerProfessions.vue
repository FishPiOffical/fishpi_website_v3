<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import LegacyOwnerProfessions from './LegacyOwnerProfessions.vue'
import V3OwnerProfessions from './V3OwnerProfessions.vue'
</script>
<template><LegacyOwnerProfessions v-if="getApiMode() === 'v1'" /><V3OwnerProfessions v-else /></template>
