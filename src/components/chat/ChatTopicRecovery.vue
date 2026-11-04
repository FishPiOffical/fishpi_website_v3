<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyChatTopicRecovery from './LegacyChatTopicRecovery.vue'
import V3ChatTopicRecovery from './V3ChatTopicRecovery.vue'
const legacy=getApiMode()==='v1'

</script>
<template><LegacyChatTopicRecovery v-if="legacy"/><V3ChatTopicRecovery v-else/></template>
