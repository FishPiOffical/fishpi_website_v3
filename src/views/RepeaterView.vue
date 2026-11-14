<script setup lang="ts">
import RepeaterRecovery from '@/components/RepeaterRecovery.vue'
import {ref} from 'vue'
import {RouterLink} from 'vue-router'
import {REPEATER_KINDS,type RepeaterKind} from '@/api/v3-repeater'
import {useRepeaterFeed} from '@/composables/useRepeaterFeed'
import {usePageSeo} from '@/composables/usePageSeo'
import {consumeRepeaterPayload} from '@/seo/payload'
import RepeaterLikeButton from '@/components/RepeaterLikeButton.vue'
import RepeaterComposer from '@/components/RepeaterComposer.vue'
usePageSeo(()=>({title:'复读机',path:'/repeater',description:'摸鱼派复读机精选'}))
const expanded = ref<Record<string, boolean>>({})
const kind=ref<RepeaterKind>(''),feed=useRepeaterFeed(kind,consumeRepeaterPayload()),{items,loading,error,ready}=feed
</script>
<template><section class="card fp-page fp-ui fp-surface"><h1 class="fp-page-title">复读机</h1><p class="hint">按点赞数与时间展示前12条，支持筛选类型。</p><div class="tabs fp-tabs"><button class="fp-control" v-for="option in [{value:'',label:'全部'},...REPEATER_KINDS]" :key="option.value" type="button" :class="{on:kind===option.value}" @click="kind=option.value as RepeaterKind">{{ option.label }}</button></div><button type="button" class="fp-control refresh-repeater-btn" :disabled="loading" @click="feed.refresh">刷新列表</button><p v-if="loading" role="status">正在读取复读内容…</p><p v-if="error" class="err fp-state" role="alert">{{ error }} <button class="fp-control" type="button" @click="feed.retry">重试读取</button></p><ol><li v-for="item in items" :key="item.id"><header><RouterLink v-if="item.author" :to="`/member/${encodeURIComponent(item.author.name)}`">{{ item.author.name }}</RouterLink><span v-else>作者未展示</span><span>{{ REPEATER_KINDS.find(k=>k.value===item.type)?.label }}</span></header><p :class="{ clamped: !expanded[item.id] && item.content.length > 180 }">{{ item.content }}</p><footer class="entry-actions"><button v-if="item.content.length > 180" type="button" class="expand-copy" :aria-expanded="!!expanded[item.id]" @click="expanded[item.id] = !expanded[item.id]">{{ expanded[item.id] ? '收起' : '展开全文' }}</button><RepeaterLikeButton :item="item"/></footer></li></ol><p v-if="ready&&!loading&&!error&&!items.length" class="hint">当前没有内容。</p><p v-if="!ready&&!loading&&!error" role="status">复读机尚未读取。</p><RepeaterRecovery /><RepeaterComposer/></section></template>
<style scoped lang="scss">
.clamped { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 5; overflow: hidden; }
.entry-actions { display:flex; justify-content:flex-end; align-items:center; gap:8px; margin-top:auto; }
.expand-copy { margin-right:auto; padding:4px 0; border:0; background:transparent; color:var(--fp-muted); font-size:12px; cursor:pointer; }
.refresh-repeater-btn {
  display: none;
}
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius);
}
h1 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 700;
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
  margin: 0 0 12px;
}
.err {
  color: var(--fp-danger);
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 16px;
  padding: 6px 8px;
  background: var(--fp-surface-subtle);
  border: 1px solid var(--fp-divider);
  border-radius: 10px;
}
.tabs button,
.ghost {
  border: 1px solid transparent;
  background: transparent;
  color: var(--fp-muted);
  border-radius: 8px;
  padding: 5px 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.16s ease;

  &:hover {
    color: var(--fp-title);
    background: var(--fp-hover);
  }
}
.tabs button.on {
  background: color-mix(in srgb, var(--fp-accent) 14%, var(--fp-card));
  color: var(--fp-accent);
  border-color: color-mix(in srgb, var(--fp-accent) 38%, var(--fp-border));
  font-weight: 600;
}
ol {
  list-style: none;
  margin: 0 0 18px;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
li {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--fp-surface-subtle);
  border: 1px solid var(--fp-divider);
  border-radius: 12px;
  transition: border-color 0.16s ease, transform 0.16s ease;

  &:hover {
    border-color: var(--fp-border);
    transform: translateY(-1px);
  }

  > p {
    margin: 8px 0 12px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--fp-title);
    overflow-wrap: anywhere;
  }
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12.5px;
  color: var(--fp-muted);

  > span:last-child {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--fp-card);
    border: 1px solid var(--fp-divider);
  }
}
header a {
  color: var(--fp-title);
  font-weight: 600;
  text-decoration: none;

  &:hover {
    color: var(--fp-accent);
  }
}
</style>
