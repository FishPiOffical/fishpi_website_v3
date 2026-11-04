<script setup lang="ts">
import {onBeforeUnmount,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {legacyBarrageInput} from '@/api/legacy/chat-barrage'
import {useAuthStore} from '@/stores/auth'
import {useLegacyChatActionsStore} from '@/stores/legacyChatActions'
import {useLegacyChatBarragePriceStore} from '@/stores/legacyChatBarragePrice'
import {fpConfirm} from '@/composables/useDialog'
import ChatBarragePrice from './ChatBarragePrice.vue'
const auth=useAuthStore(),store=useLegacyChatActionsStore(),price=useLegacyChatBarragePriceStore(),emit=defineEmits<{close:[]}>(),draft=ref(''),color=ref('#FFFFFF'),confirming=ref(false),validation=ref('')
let abort:AbortController|null=null,submitted=''
const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId||''])
function cancel(){abort?.abort();abort=null;confirming.value=false}
async function save(){if(!auth.apiKey||!auth.account?.oId||store.busy||store.pending||confirming.value)return;let normalized;try{normalized=legacyBarrageInput(draft.value,color.value);validation.value=''}catch(e){validation.value=e instanceof Error?e.message:'弹幕不合法';return}
 cancel();const controller=new AbortController(),reader=identity();abort=controller;confirming.value=true;await price.read()
 if(controller.signal.aborted||reader!==identity()||!price.price){if(abort===controller){abort=null;confirming.value=false}return}
 const yes=await fpConfirm({title:'发送聊天室弹幕',message:`当前价格为${price.price.amount} ${price.price.unit}，实际费用以发送时为准。弹幕即时播放，不保证送达。旧接口没有幂等恢复，未知结果不会自动重发或补播。是否发送？`,confirmText:'确认发送弹幕',signal:controller.signal})
 if(yes&&!controller.signal.aborted&&reader===identity()){submitted=JSON.stringify(normalized);await store.sendBarrage(normalized.content,normalized.color)}if(abort===controller){abort=null;confirming.value=false}}
watch(()=>store.completed,command=>{if(command?.kind!=='barrage'||JSON.stringify(command.input)!==submitted)return;try{if(JSON.stringify(legacyBarrageInput(draft.value,color.value))===submitted){draft.value='';submitted='';emit('close')}}catch{}})
watch(identity,()=>{cancel();draft.value='';submitted='';validation.value=''},{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template><div><ChatBarragePrice/><p v-if="validation" role="alert">{{ validation }}</p><form class="barrage-editor" @submit.prevent="save"><label>弹幕正文 <input v-model="draft" maxlength="32" placeholder="1至32个UTF-16单位的纯文本" :disabled="!auth.apiKey||store.busy||!!store.pending||confirming"/></label><label class="color">颜色 <input v-model="color" type="color" :disabled="!auth.apiKey||store.busy||!!store.pending||confirming"/></label><button type="submit" :disabled="!auth.apiKey||!draft.trim()||store.busy||!!store.pending||confirming">发送弹幕</button><button type="button" @click="emit('close')">取消</button></form></div></template>
<style scoped lang="scss">.barrage-editor{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 0}label{flex:1;min-width:160px;font-size:13px}.color{flex:0;min-width:60px}input{box-sizing:border-box;width:100%}input[type=color]{height:34px;padding:2px}button,input{font:inherit;border:1px solid var(--fp-border);border-radius:5px;padding:6px;background:var(--fp-card);color:var(--fp-text)}button:disabled,input:disabled{opacity:.5}p{font-size:13px;margin:6px 0}[role=alert]{color:#bd503c}</style>
