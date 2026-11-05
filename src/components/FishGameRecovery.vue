<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyFishGameRecovery from './LegacyFishGameRecovery.vue'
import V3FishGameRecovery from './V3FishGameRecovery.vue'
</script>
<template><LegacyFishGameRecovery v-if="getApiMode()==='v1'"/><V3FishGameRecovery v-else/></template>
