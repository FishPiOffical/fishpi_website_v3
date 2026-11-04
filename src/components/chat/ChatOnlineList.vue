<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import V3ChatOnlineList from './V3ChatOnlineList.vue'
import LegacyChatOnlineList from './LegacyChatOnlineList.vue'
</script>
<template><LegacyChatOnlineList v-if="getApiMode()==='v1'" /><V3ChatOnlineList v-else /></template>
