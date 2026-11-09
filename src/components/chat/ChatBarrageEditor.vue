<script setup lang="ts">
import {onBeforeUnmount,ref,watch} from 'vue'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatBarrageStore} from '@/stores/v3ChatBarrage'
import {getAuthContextVersion} from '@/api/http'
import ChatBarrageBubble from './ChatBarrageBubble.vue'
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
 if(!controller.signal.aborted&&reader===identity()){submitted=JSON.stringify([content,tint]);await store.save(content,tint)}
 if(abort===controller){abort=null;confirming.value=false}
}
watch(()=>store.completed,command=>{if(command&&JSON.stringify([command.content,command.color])===submitted&&JSON.stringify([draft.value,color.value.toUpperCase()])===submitted){draft.value='';submitted='';emit('close')}})
watch(identity,()=>{cancel();draft.value='';submitted=''},{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template>
  <form class="barrage-editor" @submit.prevent="save">
    <label class="barrage-content">弹幕正文
      <input v-model="draft" maxlength="4096" placeholder="说点什么，让大家看到…" :disabled="store.busy || !!store.pending || confirming" />
    </label>
    <div class="barrage-sample">
      <label class="barrage-color">颜色
        <input v-model="color" type="color" :disabled="store.busy || !!store.pending || confirming" />
      </label>
      <ChatBarrageBubble :avatar="auth.account?.userAvatarURL" :color="color" :content="draft || '弹幕预览'" />
    </div>
    <div class="barrage-footer">
      <ChatBarragePrice />
      <div class="barrage-actions">
        <button type="button" @click="emit('close')">取消</button>
        <button type="submit" :disabled="!auth.accessToken || !draft.trim() || store.busy || !!store.pending || confirming">发送弹幕</button>
      </div>
    </div>
  </form>
</template>

<style scoped>
.barrage-editor { display: grid; gap: 14px; }
.barrage-content { display: flex; flex-direction: column; }
.barrage-content input { min-width: 0; }
.barrage-sample, .barrage-footer, .barrage-actions, .barrage-color { display: flex; align-items: center; gap: 8px; }
.barrage-sample { gap: 14px; }
.barrage-sample > :last-child { min-width: 0; }
.barrage-color { flex: none; }
.barrage-color input { width: 36px; height: 28px; padding: 2px; border: 1px solid var(--fp-border); border-radius: 6px; background: var(--fp-card); }
.barrage-footer { flex-wrap: wrap; border-top: 1px solid var(--fp-border); padding-top: 12px; }
.barrage-actions { margin-inline-start: auto; }
</style>
