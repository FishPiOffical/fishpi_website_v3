<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyChatRedPacketCard from './LegacyChatRedPacketCard.vue'
import V3ChatRedPacketCard from './V3ChatRedPacketCard.vue'
const legacy=getApiMode()==='v1'
import type {RedPacketContent} from '@/api/fishpi'
defineProps<{packetId:string;packet:RedPacketContent}>()
</script>
<template><LegacyChatRedPacketCard v-if="legacy" :packet="packet" :packet-id="packetId"/><V3ChatRedPacketCard v-else :packet="packet" :packet-id="packetId"/></template>
