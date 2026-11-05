<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import LegacyOwnerGameSaves from './LegacyOwnerGameSaves.vue'
import V3OwnerGameSaves from './V3OwnerGameSaves.vue'
</script>
<template><LegacyOwnerGameSaves v-if="getApiMode() === 'v1'" /><V3OwnerGameSaves v-else /></template>
