<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyChatRedPacketDialog from './LegacyChatRedPacketDialog.vue'
import V3ChatRedPacketDialog from './V3ChatRedPacketDialog.vue'
const legacy=getApiMode()==='v1'

</script>
<template><LegacyChatRedPacketDialog v-if="legacy"/><V3ChatRedPacketDialog v-else/></template>
