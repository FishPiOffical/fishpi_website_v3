<script setup lang="ts">
import HongbaoCard from './HongbaoCard.vue'
import type {RedPacketContent} from '@/api/fishpi'
import {useLegacyChatRedPacketsStore} from '@/stores/legacyChatRedPackets'
defineProps<{packetId:string;packet:RedPacketContent}>()
const store=useLegacyChatRedPacketsStore()
</script>
<template><HongbaoCard :packet="packet" details-only @open="store.open(packetId)" /></template>
