<script setup lang="ts">
import {onBeforeUnmount,ref,watch} from 'vue'
import {useAuthStore} from '@/stores/auth'
import {useLegacyChatActionsStore} from '@/stores/legacyChatActions'
import {legacyTopicInput} from '@/api/legacy/chat'
import {fpConfirm} from '@/composables/useDialog'
const emit=defineEmits<{close:[]}>(),auth=useAuthStore(),store=useLegacyChatActionsStore(),draft=ref(''),confirming=ref(false),validation=ref('')
let abort:AbortController|null=null,submitted=''
const identity=()=>JSON.stringify([auth.apiKey,auth.account?.oId||''])
function cancel(){abort?.abort();abort=null;confirming.value=false}
async function save(){if(!auth.apiKey||!auth.account?.oId||store.pending||store.busy||confirming.value)return;let text:string;try{text=legacyTopicInput(draft.value);validation.value=''}catch(e){validation.value=e instanceof Error?e.message:'话题不合法';return}cancel();const controller=new AbortController(),reader=identity();abort=controller;confirming.value=true
 const yes=await fpConfirm({title:'修改聊天室话题',message:'每次修改消耗16积分，即使文本相同也会收费。是否继续？',confirmText:'确认修改话题',signal:controller.signal})
 if(yes&&!controller.signal.aborted&&reader===identity()){submitted=text;await store.saveTopic(text)}if(abort===controller){abort=null;confirming.value=false}}
watch(()=>store.completed,command=>{if(command?.kind==='topic'&&command.text===submitted&&draft.value.trim()===command.text){draft.value='';submitted='';emit('close')}})
watch(identity,()=>{cancel();draft.value='';submitted='';validation.value=''},{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template><form class="topic-editor" @submit.prevent="save"><p v-if="!auth.apiKey">登录后可修改话题。</p><label>新话题 <input v-model="draft" maxlength="64" placeholder="输入新话题，最多64个UTF-16单位" :disabled="!auth.apiKey||store.busy||!!store.pending||confirming" /></label><button type="submit" :disabled="!auth.apiKey||!draft.trim()||store.busy||!!store.pending||confirming">保存话题（16积分）</button><button type="button" @click="emit('close')">取消</button><p v-if="validation" role="alert">{{ validation }}</p></form></template>
<style scoped lang="scss">.topic-editor{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 0}label{flex:1;min-width:160px;font-size:13px}input{box-sizing:border-box;width:100%}button,input{font:inherit;border:1px solid var(--fp-border);border-radius:5px;padding:6px;background:var(--fp-card);color:var(--fp-text)}button:disabled,input:disabled{opacity:.5}p{font-size:13px;margin:4px 0}[role=alert]{color:#bd503c}</style>
