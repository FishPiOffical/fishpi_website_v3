<script setup lang="ts">
import type { ArticleInteractionKind,InteractionResource } from '@/api/v3-article-interactions'
import V3ArticleInteraction from './V3ArticleInteraction.vue'
withDefaults(defineProps<{kind:ArticleInteractionKind;articleId:string;initialPrice?:number;resource?:InteractionResource}>(),{initialPrice:0,resource:'articles'})
const emit=defineEmits<{contentClick:[event:MouseEvent];accepted:[]}>()
</script>
<template><V3ArticleInteraction :kind="kind" :article-id="articleId" :initial-price="initialPrice" :resource="resource" @content-click="emit('contentClick',$event)" @accepted="emit('accepted')" /></template>
