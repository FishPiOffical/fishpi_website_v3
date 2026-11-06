<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatMusicStore} from '@/stores/v3ChatMusic'
import {musicInput} from '@/api/v3-chat-music'
const auth=useAuthStore(),store=useV3ChatMusicStore(),emit=defineEmits<{close:[]}>(),title=ref(''),from=ref(''),source=ref(''),coverURL=ref(''),error=ref('')
const frozen=computed(()=>store.busy||!!store.pending)
let submitted=''
const input=()=>({title:title.value,from:from.value,source:source.value,coverURL:coverURL.value})
async function send(){if(!auth.accessToken||!auth.account?.oId||frozen.value)return;error.value='';try{const normalized=musicInput(input());submitted=JSON.stringify(normalized);await store.send(normalized)}catch(e){error.value=e instanceof Error?e.message:'音乐卡片不合法'}}
watch(()=>store.completed,command=>{if(!command||JSON.stringify(command.input)!==submitted)return;try{if(JSON.stringify(musicInput(input()))===submitted){title.value=from.value=source.value=coverURL.value='';submitted='';emit('close')}}catch{}})
watch(()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||'']),()=>{title.value=from.value=source.value=coverURL.value='';error.value='';submitted=''},{flush:'sync'})
</script>
<template><form class="music-editor" @submit.prevent="send"><label>歌曲标题<input v-model="title" maxlength="128" :disabled="frozen" required /></label><label>来源说明（可空）<input v-model="from" maxlength="64" :disabled="frozen" /></label><label>网易云歌曲ID或HTTPS音频地址<input v-model="source" maxlength="2048" :disabled="frozen" required /></label><label>HTTPS封面地址（可空）<input v-model="coverURL" maxlength="2048" :disabled="frozen" /></label><p>点击发送将发布音乐卡片。远程音频不保证可播放；歌曲ID可在网易云打开。</p><p v-if="error" role="alert">{{ error }}</p><div><button type="submit" :disabled="frozen||!title.trim()||!source">发送音乐卡片</button><button type="button" @click="emit('close')">取消</button></div></form></template>
<style scoped lang="scss">.music-editor{display:flex;flex-direction:column;gap:8px;padding:8px 0;min-width:0}label{display:flex;flex-direction:column;font-size:13px;gap:4px}input{box-sizing:border-box;width:100%;min-width:0}button,input{font:inherit;border:1px solid var(--fp-border);border-radius:5px;padding:6px;background:var(--fp-card);color:var(--fp-text)}button{margin-right:6px}button:disabled,input:disabled{opacity:.5}p{font-size:12px;margin:0;color:var(--fp-muted)}[role=alert]{color:#bd503c}</style>
