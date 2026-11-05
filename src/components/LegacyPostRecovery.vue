<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getApiMode } from '@/api/mode'
import { useAuthStore } from '@/stores/auth'
import { useLegacyPostsStore } from '@/stores/legacyPosts'
const auth=useAuthStore(),store=useLegacyPostsStore(),mounted=ref(false)
onMounted(()=>{mounted.value=true})
</script>
<template><section v-if="mounted&&getApiMode()==='v1'&&auth.apiKey&&(store.pending||store.receipt)" class="post-recovery" aria-label="旧文章操作提示"><template v-if="store.pending"><p role="alert">旧文章或草稿操作结果未确认，不能自动重发。请先核对文章与草稿列表，刷新或退出会丢失本机锁定。</p><RouterLink :to="'/member/'+auth.account?.userName">核对本人文章</RouterLink><RouterLink to="/post">核对最近草稿</RouterLink><button type="button" :disabled="store.busy" @click="store.release">我已核对，解除文章操作锁定</button></template><template v-else-if="store.receipt"><p>旧{{ store.receipt.op==='publish'?'文章发布':store.receipt.op==='draft-save'?'草稿保存':'草稿删除' }}已确认。{{ store.receipt.warning }}</p><RouterLink v-if="store.receipt.op==='publish'" :to="'/article/'+store.receipt.id">查看文章</RouterLink><button type="button" @click="store.dismiss">关闭操作提示</button></template></section></template>
<style scoped>.post-recovery{max-width:1100px;width:calc(100% - 24px);margin:8px auto;font-size:13px;overflow-wrap:anywhere}p{margin:6px 0}button,a{font:inherit;margin:3px;padding:5px 8px}button{border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
