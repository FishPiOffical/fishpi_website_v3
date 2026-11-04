<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import Legacy from './LegacyRepeaterLikeButton.vue'
import Modern from './V3RepeaterLikeButton.vue'
import type {RepeaterEntry} from '@/api/v3-repeater'
defineProps<{item:RepeaterEntry}>()
const legacy=getApiMode()==='v1'
</script>
<template><Legacy v-if="legacy" :item="item"/><Modern v-else :item="item"/></template>
