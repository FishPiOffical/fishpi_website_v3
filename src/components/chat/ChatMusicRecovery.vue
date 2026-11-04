<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyChatMusicRecovery from './LegacyChatMusicRecovery.vue'
import V3ChatMusicRecovery from './V3ChatMusicRecovery.vue'
const legacy=getApiMode()==='v1'

</script>
<template><LegacyChatMusicRecovery v-if="legacy"/><V3ChatMusicRecovery v-else/></template>
