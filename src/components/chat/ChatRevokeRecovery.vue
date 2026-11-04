<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyChatRevokeRecovery from './LegacyChatRevokeRecovery.vue'
import V3ChatRevokeRecovery from './V3ChatRevokeRecovery.vue'
const legacy=getApiMode()==='v1'

</script>
<template><LegacyChatRevokeRecovery v-if="legacy"/><V3ChatRevokeRecovery v-else/></template>
