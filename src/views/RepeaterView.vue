<script setup lang="ts">
import {ref} from 'vue'
import {RouterLink} from 'vue-router'
import {REPEATER_KINDS,type RepeaterKind} from '@/api/v3-repeater'
import {useRepeaterFeed} from '@/composables/useRepeaterFeed'
import {usePageSeo} from '@/composables/usePageSeo'
import {consumeRepeaterPayload} from '@/seo/payload'
import RepeaterLikeButton from '@/components/RepeaterLikeButton.vue'
import RepeaterComposer from '@/components/RepeaterComposer.vue'
usePageSeo(()=>({title:'复读机',path:'/repeater',description:'摸鱼派复读机精选'}))
const kind=ref<RepeaterKind>(''),feed=useRepeaterFeed(kind,consumeRepeaterPayload()),{items,loading,error,ready}=feed
</script>
<template><section class="card fp-page fp-ui fp-surface"><h1 class="fp-page-title">复读机</h1><p class="hint">按点赞数与时间展示前12条，支持筛选类型。</p><div class="tabs fp-tabs"><button class="fp-control" v-for="option in [{value:'',label:'全部'},...REPEATER_KINDS]" :key="option.value" type="button" :class="{on:kind===option.value}" @click="kind=option.value as RepeaterKind">{{ option.label }}</button></div><button type="button" class="fp-control refresh-repeater-btn" :disabled="loading" @click="feed.refresh">刷新列表</button><p v-if="loading" role="status">正在读取复读内容…</p><p v-if="error" class="err fp-state" role="alert">{{ error }} <button class="fp-control" type="button" @click="feed.retry">重试读取</button></p><ol><li v-for="item in items" :key="item.id"><header><RouterLink v-if="item.author" :to="`/member/${encodeURIComponent(item.author.name)}`">{{ item.author.name }}</RouterLink><span v-else>作者未展示</span><span>{{ REPEATER_KINDS.find(k=>k.value===item.type)?.label }}</span></header><p>{{ item.content }}</p><RepeaterLikeButton :item="item"/></li></ol><p v-if="ready&&!loading&&!error&&!items.length" class="hint">当前没有内容。</p><p v-if="!ready&&!loading&&!error" role="status">复读机尚未读取。</p><RepeaterComposer/></section></template>
<style scoped lang="scss">
.refresh-repeater-btn {
  display: none;
}
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius);

}
h1 {
  margin: 0 0 8px;
  font-size: 18px;
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.err {
  color: var(--fp-danger);
}
.tabs {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}
.tabs button,
.ghost {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-text);
  border-radius: 999px;
  padding: 4px 12px;
  cursor: pointer;
}
.tabs button.on {
  background: var(--fp-primary);
  color: #fff;
  border-color: transparent;
}
ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
li {
  padding: 12px 0;
  border-bottom: 1px solid var(--fp-border);
}
header {
  display: flex;
  gap: 8px;
  font-size: 13px;
  color: var(--fp-muted);
  margin-bottom: 6px;
}
header a {
  color: inherit;
  text-decoration: none;
}
</style>
