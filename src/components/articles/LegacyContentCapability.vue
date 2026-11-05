<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
const props = defineProps<{ capability:'article-thanks'|'comment-thanks'|'comment-accept'|'collection'|'subscription'|'tag' }>()
const auth = useAuthStore(), mounted = ref(false)
const definitions = {
  'article-thanks': { label:'感谢', reason:'旧接口未提供文章感谢的当前实际费用，当前模式暂不提供扣分操作。' },
  'comment-thanks': { label:'感谢', reason:'旧接口未提供评论感谢的当前实际费用，当前模式暂不提供扣分操作。' },
  'comment-accept': { label:'采纳', reason:'旧版采纳需要经典页面验证，当前模式暂不提供此操作。' },
  collection: { label:'收藏', reason:'旧版收藏与取消收藏依赖经典页面会话，当前模式暂不提供此操作。已有收藏仍可在收藏列表查看。' },
  subscription: { label:'订阅', reason:'旧版订阅与取消订阅依赖经典页面会话，当前模式暂不提供此操作。' },
  tag: { label:'关注标签', reason:'旧版关注与取消关注标签依赖经典页面会话，当前模式暂不提供此操作。已有关注可在关注标签列表查看。' },
} as const
const definition = computed(() => definitions[props.capability])
onMounted(() => { mounted.value = true })
</script>
<template>
  <details v-if="mounted&&auth.apiKey&&auth.account&&definition" :key="`${auth.account.oId}:${capability}`" class="legacy-capability">
    <summary>{{ definition.label }}<span>暂不可用</span></summary>
    <p role="status">{{ definition.reason }}</p>
  </details>
</template>
<style scoped>
.legacy-capability{position:relative;display:inline-block;max-width:100%;vertical-align:middle;font-size:12px}summary{display:flex;gap:6px;align-items:center;list-style:none;cursor:pointer;padding:6px 8px;border:1px solid var(--fp-border);border-radius:6px;color:var(--fp-muted);background:var(--fp-card)}summary::-webkit-details-marker{display:none}summary span{font-size:11px}summary:focus-visible{outline:2px solid var(--fp-primary);outline-offset:2px}p{box-sizing:border-box;width:260px;max-width:100%;padding:8px 0;margin:0;line-height:1.7;overflow-wrap:anywhere;color:var(--fp-muted)}
</style>
