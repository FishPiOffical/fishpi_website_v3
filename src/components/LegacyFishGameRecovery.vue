<script setup lang="ts">
import {useAuthStore} from '@/stores/auth'
import {useLegacyFishGamesStore} from '@/stores/legacyFishGames'
const auth=useAuthStore(),store=useLegacyFishGamesStore()
</script>
<template><div v-if="auth.apiKey&&(store.pending||store.receipt||store.error)" class="fish-games-recovery"><p v-if="store.error" role="alert">{{ store.error }}</p><div v-if="store.pending" role="status"><p>{{ ({submit:'鱼游投稿',edit:'鱼游编辑申请',vote:'鱼游投票切换',comment:'鱼游评论'})[store.pending.kind] }}结果未确认。旧接口没有幂等回执，不可自动重发；请先核对公开记录，投票还需在经典页面核对本人选择。</p><button type="button" :disabled="store.busy" @click="store.release">我已核对，解除锁定</button></div><p v-if="store.receipt" role="status">鱼游操作 {{ store.receipt.id }} 已确认。{{ store.receipt.kind==='submit'||store.receipt.kind==='edit'?'申请仍需审核，公开内容以重新读取为准。':'公开内容与票数以重新读取为准，旧读取不提供本人投票状态。' }}</p><button v-if="!store.pending&&!store.busy" type="button" @click="store.dismiss">关闭鱼游提示</button></div></template>
<style scoped lang="scss">.fish-games-recovery{box-sizing:border-box;max-width:1100px;width:calc(100% - 24px);margin:8px auto;overflow-wrap:anywhere;font-size:13px}p{margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;margin:3px;padding:5px 8px;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
