<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import LegacyOwnerInventory from './LegacyOwnerInventory.vue'
import V3OwnerInventory from './V3OwnerInventory.vue'
</script>
<template><LegacyOwnerInventory v-if="getApiMode() === 'v1'" /><V3OwnerInventory v-else /></template>
