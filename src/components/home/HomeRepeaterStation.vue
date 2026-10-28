<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {RouterLink} from 'vue-router'
import {getAuthContextVersion} from '@/api/http'
import {REPEATER_KINDS,type RepeaterEntry,type RepeaterKind} from '@/api/v3-repeater'
import {useRepeaterFeed} from '@/composables/useRepeaterFeed'
import {useAuthStore} from '@/stores/auth'
import RepeaterLikeButton from '@/components/RepeaterLikeButton.vue'
const props=defineProps<{initial?:RepeaterEntry[]}>(),auth=useAuthStore(),kind=ref<RepeaterKind>('joke'),feed=useRepeaterFeed(kind,props.initial),{items,loading,error,ready}=feed,current=computed(()=>items.value[0]||null),msg=ref('')
watch([kind,()=>auth.account?.oId,()=>!!auth.accessToken],()=>{msg.value=''},{flush:'sync'})
async function copy(){const item=current.value,context=getAuthContextVersion();if(!item)return;try{await navigator.clipboard.writeText(item.content);if(context===getAuthContextVersion()&&current.value?.id===item.id)msg.value='已复制'}catch{if(context===getAuthContextVersion()&&current.value?.id===item.id)msg.value='复制失败'}}
</script>
<template><section class="repeater"><header class="head"><b>复读机转录站</b><div class="tabs" role="tablist"><button v-for="option in REPEATER_KINDS" :key="option.value" type="button" role="tab" :aria-selected="kind===option.value" :class="{on:kind===option.value}" @click="kind=option.value">{{ option.label }}</button></div></header><p v-if="loading" role="status">正在读取复读内容…</p><p v-if="error" class="msg" role="alert">{{ error }} <button type="button" @click="feed.retry">重试读取</button></p><p v-else-if="current" class="quote">{{ current.content }}</p><p v-else-if="!loading&&ready" class="quote">暂无候选内容。</p><p v-else-if="!loading" class="quote" role="status">复读机尚未读取。</p><div v-if="current" class="meta"><span>{{ REPEATER_KINDS.find(k=>k.value===current.type)?.label }}</span><RouterLink v-if="current.author" :to="`/member/${encodeURIComponent(current.author.name)}`">{{ current.author.name }}</RouterLink></div><div class="actions"><button type="button" :disabled="loading||!current" @click="copy">复制</button><button type="button" :disabled="loading||!!error" @click="feed.next">换一个</button><button type="button" :disabled="loading" @click="feed.refresh">刷新</button><RepeaterLikeButton v-if="current" :item="current"/><RouterLink to="/repeater" class="more">更多与投稿</RouterLink></div><p v-if="msg" class="msg">{{ msg }}</p></section></template>
<style scoped lang="scss">
.repeater {
  margin: 0 10px 8px;
  padding: 10px 12px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--fp-head);
}
.head b {
  font-weight: 700;
  flex-shrink: 0;
}
.tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.tabs button,
.actions button,
.actions a.login,
.actions a.more {
  border: 1px solid var(--fp-border);
  background: var(--fp-hover);
  color: var(--fp-text);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  text-decoration: none;
}
.tabs button.on {
  color: var(--fp-link);
  border-color: var(--fp-link);
}
.quote {
  margin: 0;
  font-size: 13px;
  color: var(--fp-title);
  line-height: 1.45;
  min-height: 2.8em;
}
.meta {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: var(--fp-muted);
}
.meta a {
  color: var(--fp-link);
  text-decoration: none;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.actions .like {
  color: var(--fp-accent);
}
.msg {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--fp-muted);
}
</style>
