<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyChatMusicEditor from './LegacyChatMusicEditor.vue'
import V3ChatMusicEditor from './V3ChatMusicEditor.vue'
const legacy=getApiMode()==='v1'
const emit=defineEmits<{close:[]}>()
</script>
<template><LegacyChatMusicEditor v-if="legacy" @close="emit('close')"/><V3ChatMusicEditor v-else @close="emit('close')"/></template>
