<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyMutesModule from './LegacyMutesModule.vue'
import V3MutesModule from './V3MutesModule.vue'
const legacy=getApiMode()==='v1'
</script>
<template><LegacyMutesModule v-if="legacy"/><V3MutesModule v-else/></template>
