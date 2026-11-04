<script setup lang="ts">
import {computed,ref,useId,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {LEGACY_REPORT_TARGETS,legacyReportTarget,legacyReportInput} from '@/api/legacy/reports'
import {useAuthStore} from '@/stores/auth'
import {useLegacyReportsStore} from '@/stores/legacyReports'
import FpDialog from '@/components/FpDialog.vue'
const props=defineProps<{dataId:string;dataType:number}>(),auth=useAuthStore(),store=useLegacyReportsStore(),formId=useId(),open=ref(false),reason=ref<number|null>(null),memo=ref(''),error=ref(''),submitted=ref('')
const target=computed(()=>LEGACY_REPORT_TARGETS.find(t=>t.targetType===props.dataType)),frozen=computed(()=>store.busy||!!store.pending),canSubmit=computed(()=>!!auth.apiKey&&!!auth.account?.oId&&!frozen.value&&!!target.value?.reasons.some(r=>r.reason===reason.value))
function clear(){open.value=false;reason.value=null;memo.value='';error.value='';submitted.value=''}
function close(){open.value=false;error.value=''}
function show(){if(!auth.apiKey||!auth.account?.oId)return;error.value='';try{legacyReportTarget(props.dataType,props.dataId);open.value=true}catch(e){error.value=e instanceof Error?e.message:'举报目标不合法'}}
async function submit(){if(!canSubmit.value)return;error.value='';try{const input=legacyReportInput({targetType:props.dataType,targetId:props.dataId,reason:reason.value!,memo:memo.value});submitted.value=JSON.stringify(input);await store.save(input)}catch(e){error.value=e instanceof Error?e.message:'举报不合法'}}
watch(()=>store.completed,command=>{if(!command||JSON.stringify(command.input)!==submitted.value)return;memo.value='';reason.value=null;submitted.value='';close()})
watch(()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId||'',props.dataType,props.dataId]),clear,{flush:'sync'})
</script>
<template><button v-if="auth.apiKey&&auth.account?.oId" type="button" class="fp-btn fp-btn--ghost fp-btn--sm" @click="show">举报</button><p v-if="error&&!open" role="alert">{{ error }}</p><FpDialog :open="open" :title="target?`举报${target.label}`:'举报内容'" @close="close"><p>旧接口举报分类。提交成功不代表审核已处理。</p><form :id="formId" class="report-form" @submit.prevent="submit"><div class="kinds"><label v-for="kind in target?.reasons||[]" :key="kind.reason" class="kind-option" :class="{on:reason===kind.reason}"><input v-model.number="reason" type="radio" :name="formId" :value="kind.reason" :disabled="frozen"/><span>{{ kind.label }}</span></label></div><label>备注（可空）<textarea v-model="memo" class="fp-input" rows="3" maxlength="10240" :disabled="frozen" placeholder="补充需要核实的信息（纯文本）"/></label></form><p v-if="error" role="alert">{{ error }}</p><p v-if="store.error" role="alert">{{ store.error }}</p><p v-if="store.pending" role="status">已有举报结果未确认，请先核对原操作。</p><template #footer><button type="button" class="fp-btn fp-btn--ghost" @click="close">关闭</button><button type="submit" :form="formId" class="fp-btn fp-btn--primary" :disabled="!canSubmit">{{ store.busy?'提交中…':'提交举报' }}</button></template></FpDialog></template>
<style scoped lang="scss">
.report-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.kinds {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 8px;
}
.kind-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-radius-md, 8px);
  background: var(--fp-bg);
  font-size: 12px;
  color: var(--fp-text);
  cursor: pointer;
  user-select: none;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease;
}
.report-form > label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.report-form textarea { width: 100%; box-sizing: border-box; }
.kind-option { min-width: 0; overflow-wrap: anywhere; }
.kind-option input { flex: none; }
.kind-option:hover {
  border-color: var(--fp-border-strong, var(--fp-border));
  background: var(--fp-hover);
}
.kind-option.on {
  border-color: var(--fp-primary);
  background: var(--fp-primary-soft, rgba(105, 170, 105, 0.14));
  color: var(--fp-title);
  font-weight: 500;
}
.tip {
  flex: 1;
  font-size: 12px;
  color: var(--fp-muted);
}
</style>
