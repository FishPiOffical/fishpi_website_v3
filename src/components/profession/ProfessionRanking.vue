<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import LegacyProfessionRanking from './LegacyProfessionRanking.vue'
import V3ProfessionRanking from './V3ProfessionRanking.vue'
</script>
<template><LegacyProfessionRanking v-if="getApiMode() === 'v1'" /><V3ProfessionRanking v-else /></template>
