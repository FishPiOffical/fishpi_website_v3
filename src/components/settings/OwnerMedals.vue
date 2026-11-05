<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import LegacyOwnerMedals from './LegacyOwnerMedals.vue'
import V3OwnerMedals from './V3OwnerMedals.vue'
</script>
<template><LegacyOwnerMedals v-if="getApiMode() === 'v1'" /><V3OwnerMedals v-else /></template>
