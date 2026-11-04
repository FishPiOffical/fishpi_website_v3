<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyChatBarrageEditor from './LegacyChatBarrageEditor.vue'
import V3ChatBarrageEditor from './V3ChatBarrageEditor.vue'
const legacy=getApiMode()==='v1'
const emit=defineEmits<{close:[]}>()
</script>
<template><LegacyChatBarrageEditor v-if="legacy" @close="emit('close')"/><V3ChatBarrageEditor v-else @close="emit('close')"/></template>
