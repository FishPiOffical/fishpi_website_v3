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
async function save(){if(!auth.accessToken||!auth.account?.oId||store.pending||store.busy||confirming.value||!draft.value.trim())return;cancel();const controller=new AbortController();abort=controller;const reader=identity(),text=draft.value;confirming.value=true;const yes=await fpConfirm({title:'修改聊天室话题',message:'每个新操作成功将消耗16积分，即使文本相同也按一次修改收费。是否继续？',confirmText:'确认修改话题',signal:controller.signal});if(yes&&!controller.signal.aborted&&reader===identity()){submitted=text.trim();await store.save(text)}if(abort===controller){abort=null;confirming.value=false}}
watch(()=>store.completed,command=>{if(command&&command.text===submitted&&draft.value.trim()===command.text){draft.value='';submitted='';emit('close')}})
watch(identity,()=>{cancel();draft.value='';submitted=''},{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template><form class="topic-editor" @submit.prevent="save"><label>新话题 <input v-model="draft" maxlength="64" placeholder="输入新话题，最多64个UTF-16单位" :disabled="store.busy||!!store.pending||confirming" /></label><button type="submit" :disabled="!draft.trim()||store.busy||!!store.pending||confirming">保存话题（16积分）</button><button type="button" @click="emit('close')">取消</button></form></template>
<style scoped lang="scss">.topic-editor{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 0}label{flex:1;min-width:160px;font-size:13px}input{box-sizing:border-box;width:100%}button,input{font:inherit;border:1px solid var(--fp-border);border-radius:5px;padding:6px;background:var(--fp-card);color:var(--fp-text)}button:disabled,input:disabled{opacity:.5}</style>
