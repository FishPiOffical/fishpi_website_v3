<script setup lang="ts">
import {getApiMode} from '@/api/mode'
import type {ReactionTarget} from '@/api/v3-reactions'
import type {LegacyReactionSource} from '@/api/legacy/reactions'
import LegacyReactionBar from './LegacyReactionBar.vue'
import V3ReactionBarContent from './V3ReactionBarContent.vue'
const legacy=getApiMode()==='v1'
defineProps<{kind:ReactionTarget;targetId:string;readonly?:boolean;source?:LegacyReactionSource}>()
</script>
<template><LegacyReactionBar v-if="legacy" :kind="kind" :target-id="targetId" :readonly="readonly" :source="source"/><V3ReactionBarContent v-else :kind="kind" :target-id="targetId" :readonly="readonly"/></template>
