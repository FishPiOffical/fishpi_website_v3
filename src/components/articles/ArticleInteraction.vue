<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import type { ArticleInteractionKind,InteractionResource } from '@/api/v3-article-interactions'
import LegacyArticleVote from './LegacyArticleVote.vue'
import V3ArticleInteraction from './V3ArticleInteraction.vue'
withDefaults(defineProps<{kind:ArticleInteractionKind;articleId:string;initialPrice?:number;resource?:InteractionResource}>(),{initialPrice:0,resource:'articles'})
const emit=defineEmits<{contentClick:[event:MouseEvent];accepted:[]}>()
</script>
<template><LegacyArticleVote v-if="getApiMode()==='v1'&&kind==='vote'&&resource==='articles'" :article-id="articleId" /><V3ArticleInteraction v-else :kind="kind" :article-id="articleId" :initial-price="initialPrice" :resource="resource" @content-click="emit('contentClick',$event)" @accepted="emit('accepted')" /></template>
