<script setup lang="ts">
import {onBeforeUnmount,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {useAuthStore} from '@/stores/auth'
import {useV3FishGamesStore} from '@/stores/v3FishGames'
import {fpConfirm} from '@/composables/useDialog'
const auth=useAuthStore(),store=useV3FishGamesStore()
let abort:AbortController|null=null
const identity=()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||''])
function cancel(){abort?.abort();abort=null}
async function retry(){if(store.busy||!store.pending)return;cancel();const original=store.pending,reader=identity(),controller=new AbortController();abort=controller;let yes=true;if(store.needsConfirmation)yes=await fpConfirm({title:'再次确认原鱼游操作',message:'平台要求再次确认。将以原投稿/编辑、评论正文或投票状态及请求键恢复本次鱼游操作，是否继续？',confirmText:'确认原鱼游操作',signal:controller.signal});if(yes&&!controller.signal.aborted&&reader===identity()&&store.pending===original)await store.retry(true);if(abort===controller)abort=null}
watch(identity,cancel,{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template><div v-if="auth.accessToken&&(store.pending||store.receipt||store.error)" class="fish-games-recovery"><p v-if="store.error" role="alert">{{ store.error }}</p><div v-if="store.pending" role="status"><p>{{ ({submit:'鱼游投稿',edit:'鱼游编辑申请',vote:'鱼游投票',comment:'鱼游评论'})[store.pending.kind] }}结果尚未确认，原操作可恢复；刷新或退出会丢失本地恢复信息。</p><button type="button" :disabled="store.busy" @click="retry">{{ store.needsConfirmation?'再次确认原鱼游操作':'恢复本次鱼游操作' }}</button><button v-if="store.needsConfirmation" type="button" :disabled="store.busy" @click="store.cancelConfirmation">取消待确认操作</button></div><p v-if="store.receipt" role="status">鱼游操作 {{ store.receipt.id }} 已确认。{{ store.receipt.kind==='submit'||store.receipt.kind==='edit'?'申请结果不代表审核通过，公开内容仍以审核后读取为准。':'公开内容及投票状态以重新读取为准。' }}</p><button v-if="!store.pending&&!store.busy" type="button" @click="store.dismiss">关闭鱼游提示</button></div></template>
<style scoped lang="scss">.fish-games-recovery{box-sizing:border-box;max-width:1100px;width:calc(100% - 24px);margin:8px auto;overflow-wrap:anywhere;font-size:13px}p{margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;margin:3px;padding:5px 8px;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
