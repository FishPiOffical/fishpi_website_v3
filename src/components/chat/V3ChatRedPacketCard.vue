<script setup lang="ts">
import HongbaoCard from './HongbaoCard.vue'
import type {RedPacketContent} from '@/api/fishpi'
import {useV3ChatRedPacketsStore} from '@/stores/v3ChatRedPackets'
defineProps<{packetId:string;packet:RedPacketContent}>()
const store=useV3ChatRedPacketsStore()
</script>
<template><HongbaoCard :packet="packet" details-only @open="store.open(packetId)" /></template>
