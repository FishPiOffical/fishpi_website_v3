<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import LegacyPointTransfer from './LegacyPointTransfer.vue'
import V3PointTransfer from './V3PointTransfer.vue'
withDefaults(defineProps<{ initialRecipient?: string }>(), { initialRecipient: '' })
</script>
<template><LegacyPointTransfer v-if="getApiMode() === 'v1'" :initial-recipient="initialRecipient" /><V3PointTransfer v-else :initial-recipient="initialRecipient" /></template>
