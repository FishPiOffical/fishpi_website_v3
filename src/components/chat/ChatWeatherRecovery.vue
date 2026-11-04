<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyChatWeatherRecovery from './LegacyChatWeatherRecovery.vue'
import V3ChatWeatherRecovery from './V3ChatWeatherRecovery.vue'
const legacy=getApiMode()==='v1'

</script>
<template><LegacyChatWeatherRecovery v-if="legacy"/><V3ChatWeatherRecovery v-else/></template>
