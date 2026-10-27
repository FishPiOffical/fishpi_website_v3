<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { trimBreezemoonInput } from '@/api/v3-breezemoons'
import { useAuthStore } from '@/stores/auth'
import { useV3BreezemoonStore } from '@/stores/v3Breezemoons'
const props=defineProps<{target?:{id:string;content:string}|null}>(),emit=defineEmits<{cancel:[];saved:[]}>()
const{accessToken,account}=storeToRefs(useAuthStore()),operations=useV3BreezemoonStore(),mounted=ref(false),draft=ref(props.target?.content||''),localError=ref('')
const ready=computed(()=>mounted.value&&!!accessToken.value&&!!account.value),locked=computed(()=>!!operations.pending||operations.busy||operations.confirming)
const recovery=computed(()=>operations.pending?.operation==='delete'?'重试本次删除':operations.pending?.operation==='update'?'重试本次修改':'重试本次发布')
let boundary=`${getAuthContextVersion()}:${account.value?.oId||''}`
watch([accessToken,()=>account.value?.oId],()=>{const next=`${getAuthContextVersion()}:${account.value?.oId||''}`;if(!accessToken.value||next!==boundary){draft.value='';localError.value=''}boundary=next},{flush:'sync'})
watch(()=>props.target,()=>{draft.value=props.target?.content||'';localError.value=''})
let submitted:{key:string;draft:string}|null=null
watch(()=>operations.pending,command=>{if(command&&command.operation!=='delete'&&command.id===(props.target?.id||'')&&command.content===trimBreezemoonInput(draft.value))submitted={key:command.key,draft:draft.value}},{flush:'sync'})
watch(()=>operations.completed,command=>{if(command&&submitted?.key===command.key){if(draft.value===submitted.draft)draft.value='';submitted=null;emit('saved')}},{flush:'sync'})
async function submit(){if(!ready.value||locked.value)return;const valid=operations.capture();localError.value='';try{await operations.save(draft.value,props.target?.id||'')}catch(err){if(valid()&&mounted.value)localError.value=err instanceof Error?err.message:'输入不合法'}}
onMounted(()=>{mounted.value=true});onBeforeUnmount(()=>{mounted.value=false;draft.value='';localError.value=''})
</script>
<template>
  <div class="moon-composer">
    <p v-if="!mounted">正在准备发布…</p>
    <RouterLink v-else-if="!ready" to="/login">登录后发布清风明月</RouterLink>
    <template v-else>
      <template v-if="operations.pending"><p>上次{{ operations.pending.operation==='delete'?'删除':operations.pending.operation==='update'?'修改':'发布' }}结果待确认，请恢复同一次操作。</p><p v-if="operations.pending.content" class="pending-content">{{ operations.pending.content }}</p><button type="button" :disabled="operations.busy" @click="operations.retry()">{{ operations.busy?'正在确认…':recovery }}</button></template>
      <form v-else @submit.prevent="submit"><label>{{ target?'修改动态':'写一条动态' }}<textarea v-model="draft" :disabled="locked" rows="2" placeholder="与清风明月为伴，记录当下…" @keydown.ctrl.enter.prevent="submit" @keydown.meta.enter.prevent="submit" /></label><span>{{ trimBreezemoonInput(draft).length }} / 512</span><button type="submit" :disabled="locked||!trimBreezemoonInput(draft)">{{ operations.busy?'提交中…':target?'保存修改':'发布' }}</button><button v-if="target" type="button" :disabled="locked" @click="emit('cancel')">取消编辑</button></form>
      <p v-if="localError||operations.error" role="alert">{{ localError||operations.error }}</p><p v-if="operations.message" role="status">{{ operations.message }}</p>
    </template>
  </div>
</template>
<style scoped lang="scss">
.moon-composer { padding: 12px 0; min-width: 0; } form { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; } label { flex: 1 1 100%; } textarea { display: block; box-sizing: border-box; width: 100%; margin-top: 6px; resize: vertical; padding: 8px; border: 1px solid var(--fp-border); border-radius: 6px; background: var(--fp-card); color: var(--fp-text); } button { padding: 7px 11px; border: 1px solid var(--fp-border); border-radius: 6px; background: var(--fp-card); color: var(--fp-text); cursor: pointer; } button:disabled { opacity: .5; cursor: default; } p { overflow-wrap: anywhere; } .pending-content { white-space: pre-wrap; } [role='alert'] { color: #c34a36; } a { color: var(--fp-link); }
</style>
