<script setup lang="ts">
import {onBeforeUnmount,ref,watch} from 'vue'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatTopicStore} from '@/stores/v3ChatTopic'
import {getAuthContextVersion} from '@/api/http'
import {fpConfirm} from '@/composables/useDialog'
const emit=defineEmits<{close:[]}>(),auth=useAuthStore(),store=useV3ChatTopicStore(),draft=ref(''),confirming=ref(false)
let abort:AbortController|null=null,submitted=''
const identity=()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||''])
function cancel(){abort?.abort();abort=null;confirming.value=false}
async function save(){if(!auth.accessToken||!auth.account?.oId||store.pending||store.busy||confirming.value||!draft.value.trim()||draft.value.length>16)return;cancel();const controller=new AbortController();abort=controller;const reader=identity(),text=draft.value;confirming.value=true;const yes=await fpConfirm({title:'修改聊天室话题',message:'每个新操作成功将消耗16积分，即使文本相同也按一次修改收费。是否继续？',confirmText:'确认修改话题',signal:controller.signal});if(yes&&!controller.signal.aborted&&reader===identity()){submitted=text.trim();await store.save(text)}if(abort===controller){abort=null;confirming.value=false}}
watch(()=>store.completed,command=>{if(command&&command.text===submitted&&draft.value.trim()===command.text){draft.value='';submitted='';emit('close')}})
watch(identity,()=>{cancel();draft.value='';submitted=''},{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template>
 <form class="topic-editor" @submit.prevent="save">
  <label>编辑话题<input v-model="draft" maxlength="16" placeholder="想和大家聊点什么？" :disabled="store.busy||!!store.pending||confirming" /></label>
  <div class="editor-meta"><span>最多 16 字符 · 修改需 16 积分</span><span>{{ draft.length }}/16</span></div>
  <div class="editor-actions"><button type="button" @click="emit('close')">取消</button><button class="save" type="submit" :disabled="!draft.trim()||draft.length>16||store.busy||!!store.pending||confirming">{{ store.busy ? '保存中…' : '保存话题' }}</button></div>
 </form>
</template>
<style scoped>
.topic-editor { display:flex; flex-direction:column; gap:8px; padding-top:12px; }
label { font-size:12px; font-weight:600; color:var(--fp-head); }
input { display:block; box-sizing:border-box; width:100%; margin-top:6px; padding:9px 10px; border:1px solid var(--fp-border); border-radius:7px; background:var(--fp-bg); color:var(--fp-text); font:inherit; font-weight:400; }
.editor-meta { display:flex; justify-content:space-between; gap:6px; color:var(--fp-muted); font-size:10px; }
.editor-actions { display:flex; justify-content:flex-end; gap:6px; }
button { padding:6px 10px; border:1px solid var(--fp-border); border-radius:6px; background:var(--fp-card); color:var(--fp-text); font:inherit; font-size:12px; cursor:pointer; }
button:hover:not(:disabled) { background:var(--fp-hover); }
button.save { background:var(--fp-primary); border-color:var(--fp-primary); color:#fff; }
button.save:hover:not(:disabled) { filter:brightness(.96); background:var(--fp-primary); }
button:disabled,input:disabled { opacity:.5; cursor:default; }
button:focus-visible,input:focus-visible { outline:2px solid var(--fp-primary); outline-offset:2px; }
</style>
