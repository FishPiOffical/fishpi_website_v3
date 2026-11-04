<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import Legacy from './LegacyRepeaterComposer.vue'
import Modern from './V3RepeaterComposer.vue'
const legacy=getApiMode()==='v1'
</script>
<template><Legacy v-if="legacy"/><Modern v-else/></template>
