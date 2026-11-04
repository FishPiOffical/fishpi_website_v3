<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyChatBarrageOverlay from './LegacyChatBarrageOverlay.vue'
import V3ChatBarrageOverlay from './V3ChatBarrageOverlay.vue'
const legacy=getApiMode()==='v1'

</script>
<template><LegacyChatBarrageOverlay v-if="legacy"/><V3ChatBarrageOverlay v-else/></template>
