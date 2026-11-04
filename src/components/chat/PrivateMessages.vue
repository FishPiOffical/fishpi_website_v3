<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import V3PrivateMessages from './V3PrivateMessages.vue'
import LegacyPrivateMessages from './LegacyPrivateMessages.vue'
withDefaults(defineProps<{initialName?:string;initialId?:string}>(),{initialName:'',initialId:''})
const emit=defineEmits<{'peer-selected':[peer:{id:string;userName:string}];'connection-change':[state:string]}>()
function selected(peer:{id:string;userName:string}){emit('peer-selected',peer)}
function connectionChanged(state:string){emit('connection-change',state)}
</script>
<template><component :is="getApiMode()==='v1'?LegacyPrivateMessages:V3PrivateMessages" :initial-name="initialName" :initial-id="initialId" @connection-change="connectionChanged" @peer-selected="selected" /></template>
