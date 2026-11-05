<script setup lang="ts">
import {onMounted,reactive,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import type {FishGame,GameSubmission} from '@/api/v3-fish-games'
import {useAuthStore} from '@/stores/auth'
import {useLegacyFishGamesStore} from '@/stores/legacyFishGames'
const props=defineProps<{game?:FishGame}>(),emit=defineEmits<{close:[]}>(),auth=useAuthStore(),store=useLegacyFishGamesStore(),mounted=ref(false),submitted=ref('')
const blank=():GameSubmission=>({name:'',description:'',url:'',iconUrl:'',oauthLoginUrl:''}),form=reactive(blank())
function reset(){Object.assign(form,blank(),props.game?{name:props.game.name,description:props.game.description,url:props.game.url,iconUrl:props.game.iconURL}:{});submitted.value=''}
watch(()=>props.game,reset,{immediate:true});watch(()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId||'']),reset,{flush:'sync'})
async function submit(){if(store.pending||store.busy)return;submitted.value=JSON.stringify({id:props.game?.id||'',body:{...form}});await store.submit({...form},props.game?.id||'')}
watch(()=>store.completed,c=>{if((c?.kind==='submit'||c?.kind==='edit')&&submitted.value===JSON.stringify({id:c.id,body:c.body})){Object.assign(form,blank());submitted.value='';if(c.kind==='edit')emit('close')}})
onMounted(()=>{mounted.value=true})
</script>
<template><form v-if="mounted&&auth.apiKey&&auth.account?.oId" class="game-form" @submit.prevent="submit"><h2>{{ game?'申请编辑鱼游':'鱼游投稿' }}</h2><p>四项均必填。名称与简介由旧服务端去HTML并限制为80和1000字符，游戏与图标须为HTTPS；提交后等待审核。</p><label>名称<input v-model="form.name" maxlength="16384" required :disabled="store.busy||!!store.pending"/></label><label>简介<textarea v-model="form.description" rows="3" maxlength="16384" required :disabled="store.busy||!!store.pending"/></label><label>游戏URL<input v-model="form.url" type="url" maxlength="512" required :disabled="store.busy||!!store.pending"/></label><label>图标URL<input v-model="form.iconUrl" type="url" maxlength="512" required :disabled="store.busy||!!store.pending"/></label><p v-if="game">公开内容在审核批准前保持原样；如已有待审申请，服务端会拒绝重复申请。</p><div><button type="submit" :disabled="store.busy||!!store.pending">{{ store.busy?'提交中…':game?'提交编辑申请':'提交审核' }}</button><button v-if="game" type="button" @click="emit('close')">关闭编辑</button></div></form></template>
<style scoped lang="scss">.game-form{display:flex;flex-direction:column;gap:8px}h2{font-size:16px;margin:0}p{margin:0;font-size:13px;color:var(--fp-muted)}label{display:flex;flex-direction:column;gap:5px}input,textarea,button{box-sizing:border-box;font:inherit;padding:8px;border:1px solid var(--fp-border);border-radius:6px;background:var(--fp-bg);color:var(--fp-text)}textarea{width:100%}button{margin:4px}</style>
