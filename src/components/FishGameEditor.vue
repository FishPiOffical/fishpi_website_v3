<script setup lang="ts">
import {onMounted,reactive,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import type {FishGame,GameSubmission} from '@/api/v3-fish-games'
import {useAuthStore} from '@/stores/auth'
import {useV3FishGamesStore} from '@/stores/v3FishGames'
const props=defineProps<{game?:FishGame}>(),emit=defineEmits<{close:[]}>(),auth=useAuthStore(),store=useV3FishGamesStore(),mounted=ref(false),submitted=ref('')
const blank=():GameSubmission=>({name:'',description:'',url:'',iconUrl:'',oauthLoginUrl:''}),form=reactive(blank())
function reset(){Object.assign(form,blank(),props.game?{name:props.game.name,description:props.game.description,url:props.game.url,iconUrl:props.game.iconURL}:{});submitted.value=''}
watch(()=>props.game,reset,{immediate:true});watch(()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||'']),reset,{flush:'sync'})
async function submit(){if(store.pending||store.busy)return;submitted.value=JSON.stringify({id:props.game?.id||'',body:{...form}});await store.submit({...form},props.game?.id||'')}
watch(()=>store.completed,c=>{if((c?.kind==='submit'||c?.kind==='edit')&&submitted.value===JSON.stringify({id:c.id,body:c.body})){Object.assign(form,blank());submitted.value='';if(c.kind==='edit')emit('close')}})
onMounted(()=>{mounted.value=true})
</script>
<template>
  <form v-if="mounted&&auth.accessToken&&auth.account?.oId" class="game-form" @submit.prevent="submit">
    <div class="form-intro"><h2>{{ game?'申请编辑鱼游':'鱼游投稿' }}</h2><p>填写完整的游戏信息，审核通过后将在社区展示。<a href="https://fishpi.cn/article/1782119519493" target="_blank" rel="noopener noreferrer">查看 OAuth 接入说明 ↗</a></p></div>
    <label class="wide-field">名称<input v-model="form.name" maxlength="16384" required :disabled="store.busy||!!store.pending" placeholder="给你的游戏起个名字"/></label>
    <label class="wide-field">简介<textarea v-model="form.description" rows="3" maxlength="16384" required :disabled="store.busy||!!store.pending" placeholder="介绍玩法与特色，让大家知道它有什么有趣之处"/></label>
    <label>游戏URL<input v-model="form.url" type="url" maxlength="512" required :disabled="store.busy||!!store.pending" placeholder="https://"/></label>
    <label>图标URL<input v-model="form.iconUrl" type="url" maxlength="512" required :disabled="store.busy||!!store.pending" placeholder="https://"/></label>
    <label class="wide-field">OAuth授权网址<textarea v-model="form.oauthLoginUrl" maxlength="4096" rows="2" required :disabled="store.busy||!!store.pending" placeholder="按接入说明填写完整授权网址"/></label>
    <p v-if="game" class="wide-field">编辑申请通过前，公开内容保持原样。请重新填写对应授权网址。</p>
    <div class="form-actions"><span>全部字段必填 · 提交后进入审核</span><button type="submit" :disabled="store.busy||!!store.pending">{{ store.busy?'提交中…':game?'提交编辑申请':'提交审核' }}</button><button v-if="game" type="button" @click="emit('close')">关闭编辑</button></div>
  </form>
</template>
<style scoped>
.game-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:4px}.wide-field,.form-intro,.form-actions{grid-column:1/-1}.form-intro{margin-bottom:2px}h2{font-size:16px;margin:0 0 8px;color:var(--fp-title)}p{margin:0;font-size:12px;color:var(--fp-muted);line-height:1.8}p a{color:var(--fp-primary);margin-left:6px}label{display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--fp-text);min-width:0}input,textarea,button{box-sizing:border-box;font:inherit;padding:10px 12px;border:1px solid var(--fp-border);border-radius:8px;background:var(--fp-surface-subtle);color:var(--fp-text)}input,textarea{width:100%;min-width:0}textarea{resize:vertical}input:focus,textarea:focus{outline:2px solid var(--fp-primary);outline-offset:2px}.form-actions{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:10px;padding-top:4px}.form-actions>span{margin-right:auto;font-size:11px;color:var(--fp-muted)}button{background:var(--fp-card);cursor:pointer;font-size:12px}button[type=submit]{background:var(--fp-primary);border-color:var(--fp-primary);color:#fff}button:disabled{opacity:.5;cursor:default}@media(max-width:640px){.game-form{grid-template-columns:minmax(0,1fr);gap:14px}.form-actions>span{width:100%}}
</style>
