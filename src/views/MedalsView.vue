<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import LegacyPublicMedals from '@/components/medal/LegacyPublicMedals.vue'
import V3MedalsView from './V3MedalsView.vue'
</script>
<template><LegacyPublicMedals v-if="getApiMode() === 'v1'" /><V3MedalsView v-else /></template>
