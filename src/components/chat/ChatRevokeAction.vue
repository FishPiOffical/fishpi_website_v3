<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import LegacyChatRevokeAction from './LegacyChatRevokeAction.vue'
import V3ChatRevokeAction from './V3ChatRevokeAction.vue'
const legacy=getApiMode()==='v1'
const props=defineProps<{id:string;authorId?:string;redPacket?:boolean}>()
</script>
<template><LegacyChatRevokeAction v-if="legacy" v-bind="props"/><V3ChatRevokeAction v-else v-bind="props"/></template>
