<script setup lang="ts">
import {ref} from 'vue'
import {getApiMode} from '@/api/mode'
import LegacyCommentComposer from './LegacyCommentComposer.vue'
import V3CommentComposer from './V3CommentComposer.vue'
const legacy=getApiMode()==='v1',child=ref<InstanceType<typeof V3CommentComposer>|null>(null)
defineProps<{articleId:string;editId?:string;parentId?:string;paragraphId?:string;replyLabel?:string;writable?:boolean}>()
const emit=defineEmits<{cancel:[];saved:[];clearReply:[]}>()
defineExpose({reveal:()=>child.value?.reveal()})
</script>
<template><component :is="legacy?LegacyCommentComposer:V3CommentComposer" ref="child" :article-id="articleId" :edit-id="editId" :parent-id="parentId" :paragraph-id="paragraphId" :reply-label="replyLabel" :writable="writable" @cancel="emit('cancel')" @saved="emit('saved')" @clear-reply="emit('clearReply')"/></template>
