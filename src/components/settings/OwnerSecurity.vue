<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import LegacyOwnerSecurity from './LegacyOwnerSecurity.vue'
import V3OwnerSecurity from './V3OwnerSecurity.vue'
</script>
<template><LegacyOwnerSecurity v-if="getApiMode()==='v1'" /><V3OwnerSecurity v-else /></template>
