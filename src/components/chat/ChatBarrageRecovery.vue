<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyChatBarrageRecovery from './LegacyChatBarrageRecovery.vue'
import V3ChatBarrageRecovery from './V3ChatBarrageRecovery.vue'
const legacy=getApiMode()==='v1'

</script>
<template><LegacyChatBarrageRecovery v-if="legacy"/><V3ChatBarrageRecovery v-else/></template>
