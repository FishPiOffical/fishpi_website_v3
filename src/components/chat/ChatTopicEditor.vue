<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyChatTopicEditor from './LegacyChatTopicEditor.vue'
import V3ChatTopicEditor from './V3ChatTopicEditor.vue'
const legacy=getApiMode()==='v1'
const emit=defineEmits<{close:[]}>()
</script>
<template><LegacyChatTopicEditor v-if="legacy" @close="emit('close')"/><V3ChatTopicEditor v-else @close="emit('close')"/></template>
