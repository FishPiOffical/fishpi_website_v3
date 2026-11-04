<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyChatRedPacketRecovery from './LegacyChatRedPacketRecovery.vue'
import V3ChatRedPacketRecovery from './V3ChatRedPacketRecovery.vue'
const legacy=getApiMode()==='v1'

</script>
<template><LegacyChatRedPacketRecovery v-if="legacy"/><V3ChatRedPacketRecovery v-else/></template>
