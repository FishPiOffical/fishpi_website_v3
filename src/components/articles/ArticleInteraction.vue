<script setup lang="ts">
import { getApiMode } from '@/api/mode'
import type { ArticleInteractionKind,InteractionResource } from '@/api/v3-article-interactions'
import LegacyArticleVote from './LegacyArticleVote.vue'
import LegacyCommentVote from './LegacyCommentVote.vue'
import LegacyArticleReward from './LegacyArticleReward.vue'
import V3ArticleInteraction from './V3ArticleInteraction.vue'
withDefaults(defineProps<{kind:ArticleInteractionKind;articleId:string;initialPrice?:number;resource?:InteractionResource;source?:import('@/api/legacy/reactions').LegacyReactionSource}>(),{initialPrice:0,resource:'articles'})
const emit=defineEmits<{contentClick:[event:MouseEvent];accepted:[]}>()
</script>
<template><LegacyArticleVote v-if="getApiMode()==='v1'&&kind==='vote'&&resource==='articles'" :article-id="articleId" /><LegacyCommentVote v-else-if="getApiMode()==='v1'&&kind==='vote'&&resource==='comments'" :comment-id="articleId" :source="source" /><LegacyArticleReward v-else-if="getApiMode()==='v1'&&kind==='reward'&&resource==='articles'" :article-id="articleId" :initial-price="initialPrice" @content-click="emit('contentClick',$event)" /><V3ArticleInteraction v-else :kind="kind" :article-id="articleId" :initial-price="initialPrice" :resource="resource" @content-click="emit('contentClick',$event)" @accepted="emit('accepted')" /></template>
