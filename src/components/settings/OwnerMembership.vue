<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import LegacyOwnerMembership from './LegacyOwnerMembership.vue'
import V3OwnerMembership from './V3OwnerMembership.vue'
</script>
<template><LegacyOwnerMembership v-if="getApiMode() === 'v1'" /><V3OwnerMembership v-else /></template>
