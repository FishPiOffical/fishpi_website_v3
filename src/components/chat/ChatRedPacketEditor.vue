<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyChatRedPacketEditor from './LegacyChatRedPacketEditor.vue'
import V3ChatRedPacketEditor from './V3ChatRedPacketEditor.vue'
const legacy=getApiMode()==='v1'
const emit=defineEmits<{close:[]}>()
</script>
<template><LegacyChatRedPacketEditor v-if="legacy" @close="emit('close')"/><V3ChatRedPacketEditor v-else @close="emit('close')"/></template>
