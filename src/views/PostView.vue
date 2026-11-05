<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import LegacyPostView from './LegacyPostView.vue'
import V3PostView from './V3PostView.vue'
</script>
<template><LegacyPostView v-if="getApiMode() === 'v1'" /><V3PostView v-else /></template>
