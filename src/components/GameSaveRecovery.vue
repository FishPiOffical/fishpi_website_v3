<script setup lang="ts">
import {onBeforeUnmount,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {useAuthStore} from '@/stores/auth'
import {useV3GameSavesStore} from '@/stores/v3GameSaves'
import {RouterLink} from 'vue-router'
import {fpConfirm} from '@/composables/useDialog'
const auth=useAuthStore(),store=useV3GameSavesStore()
let abort:AbortController|null=null
const identity=()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||''])
function cancel(){abort?.abort();abort=null}
async function retry(){if(store.busy||!store.pending)return;cancel();const original=store.pending,reader=identity(),controller=new AbortController();abort=controller;let yes=true;if(store.needsConfirmation)yes=await fpConfirm({title:'再次确认原存档操作',message:'平台要求再次确认。将以原保存内容与版本或原迁移请求及请求键恢复本次操作，是否继续？',confirmText:'确认原大事记操作',signal:controller.signal});if(yes&&!controller.signal.aborted&&reader===identity()&&store.pending===original)await store.retry(true);if(abort===controller)abort=null}
watch(identity,cancel,{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template><div v-if="auth.accessToken&&(store.pending||store.receipt||store.error)" class="game-save-recovery"><p v-if="store.error" role="alert">{{ store.error }}</p><div v-if="store.pending" role="status"><p>本次存档操作结果尚未确认，原操作可恢复；刷新或退出会丢失本地恢复信息。</p><button type="button" :disabled="store.busy" @click="retry">{{ store.needsConfirmation?'再次确认原存档操作':'恢复本次存档操作' }}</button><button v-if="store.needsConfirmation" type="button" :disabled="store.busy" @click="store.cancelConfirmation">取消待确认操作</button></div><p v-if="store.receipt" role="status">Evolve存档操作已确认，提交版本 {{ store.receipt.revision }}。当前版本和正文请重新读取；原回执不会覆盖后来保存的存档。<RouterLink to="/settings/data">管理当前存档</RouterLink></p><button v-if="!store.pending&&!store.busy" type="button" @click="store.dismiss">关闭存档提示</button></div></template>
<style scoped lang="scss">.game-save-recovery{box-sizing:border-box;max-width:1100px;width:calc(100% - 24px);margin:8px auto;overflow-wrap:anywhere;font-size:13px}p{margin:6px 0}[role=alert]{color:#bd503c}button{font:inherit;margin:3px;padding:5px 8px;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text)}</style>
