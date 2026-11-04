<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyChatWeatherEditor from './LegacyChatWeatherEditor.vue'
import V3ChatWeatherEditor from './V3ChatWeatherEditor.vue'
const legacy=getApiMode()==='v1'
const emit=defineEmits<{close:[]}>()
</script>
<template><LegacyChatWeatherEditor v-if="legacy" @close="emit('close')"/><V3ChatWeatherEditor v-else @close="emit('close')"/></template>
