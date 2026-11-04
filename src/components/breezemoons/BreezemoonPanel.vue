<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyBreezemoonPanel from './LegacyBreezemoonPanel.vue'
import V3BreezemoonPanel from './V3BreezemoonPanel.vue'
withDefaults(defineProps<{size?:number;compact?:boolean;manage?:boolean;ssrScope?:'global'|'home'}>(),{size:20,compact:false,manage:false})
const legacy=getApiMode()==='v1'
</script>
<template><LegacyBreezemoonPanel v-if="legacy" :size="size" :compact="compact" :manage="manage" /><V3BreezemoonPanel v-else :size="size" :compact="compact" :manage="manage" :ssr-scope="ssrScope" /></template>
