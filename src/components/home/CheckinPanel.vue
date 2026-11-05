<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyCheckinPanel from './LegacyCheckinPanel.vue'
import V3CheckinPanel from './V3CheckinPanel.vue'
</script>
<template><LegacyCheckinPanel v-if="getApiMode()==='v1'"/><V3CheckinPanel v-else/></template>
