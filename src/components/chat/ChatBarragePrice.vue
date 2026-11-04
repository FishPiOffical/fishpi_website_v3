<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyChatBarragePrice from './LegacyChatBarragePrice.vue'
import V3ChatBarragePrice from './V3ChatBarragePrice.vue'
const legacy=getApiMode()==='v1'

</script>
<template><LegacyChatBarragePrice v-if="legacy"/><V3ChatBarragePrice v-else/></template>
