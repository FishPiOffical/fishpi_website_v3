<script setup lang="ts">
import {onBeforeUnmount,ref,watch} from 'vue'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatBarrageStore} from '@/stores/v3ChatBarrage'
import {getAuthContextVersion} from '@/api/http'
import {fpConfirm} from '@/composables/useDialog'
import ChatBarragePrice from './ChatBarragePrice.vue'
import {useV3ChatBarragePriceStore} from '@/stores/v3ChatBarragePrice'
const price=useV3ChatBarragePriceStore(),color=ref('#FFFFFF')
const emit=defineEmits<{close:[]}>(),auth=useAuthStore(),store=useV3ChatBarrageStore(),draft=ref(''),confirming=ref(false)
let abort:AbortController|null=null,submitted=''
const identity=()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||''])
function cancel(){abort?.abort();abort=null;confirming.value=false}
async function save(){
 if(!auth.accessToken||!auth.account?.oId||store.pending||store.busy||confirming.value||!draft.value.trim())return
 cancel();const controller=new AbortController();abort=controller;const reader=identity(),content=draft.value,tint=color.value.toUpperCase();confirming.value=true
 await price.read()
 if(controller.signal.aborted||reader!==identity()||!price.price){if(abort===controller){abort=null;confirming.value=false}return}
 const yes=await fpConfirm({title:'发送聊天室弹幕',message:`当前价格为${price.price.amount} ${price.price.unit}，实际费用以发送时为准。弹幕即时播放，不保证送达；恢复原操作不会重复扣费或补播。是否发送？`,confirmText:'确认发送弹幕',signal:controller.signal})
 if(yes&&!controller.signal.aborted&&reader===identity()){submitted=JSON.stringify([content,tint]);await store.save(content,tint)}
 if(abort===controller){abort=null;confirming.value=false}
}
watch(()=>store.completed,command=>{if(command&&JSON.stringify([command.content,command.color])===submitted&&JSON.stringify([draft.value,color.value.toUpperCase()])===submitted){draft.value='';submitted='';emit('close')}})
watch(identity,()=>{cancel();draft.value='';submitted=''},{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template><div><ChatBarragePrice /><form class="barrage-editor" @submit.prevent="save"><label>弹幕正文 <input v-model="draft" maxlength="4096" placeholder="清洗后须为1至32个UTF-16单位，不截断" :disabled="store.busy||!!store.pending||confirming" /></label><label class="color">颜色 <input v-model="color" type="color" :disabled="store.busy||!!store.pending||confirming" /></label><button type="submit" :disabled="!draft.trim()||store.busy||!!store.pending||confirming">发送弹幕</button><button type="button" @click="emit('close')">取消</button></form></div></template>
<style scoped lang="scss">.barrage-editor{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 0}label{flex:1;min-width:160px;font-size:13px}.color{flex:0;min-width:60px}input{box-sizing:border-box;width:100%}input[type=color]{height:34px;padding:2px}button,input{font:inherit;border:1px solid var(--fp-border);border-radius:5px;padding:6px;background:var(--fp-card);color:var(--fp-text)}button:disabled,input:disabled{opacity:.5}</style>
