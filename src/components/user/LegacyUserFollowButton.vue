<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {legacyReadUserFollow} from '@/api/legacy/user-follow'
import {useAuthStore} from '@/stores/auth'
import {useLegacyUserFollowStore} from '@/stores/legacyUserFollow'
const props=defineProps<{userName:string;userId?:string}>(),auth=useAuthStore(),operations=useLegacyUserFollowStore(),mounted=ref(false),targetId=ref(''),following=ref<boolean|null>(null),loading=ref(false),error=ref(''),checked=ref(false)
const visible=computed(()=>mounted.value&&!!auth.apiKey&&!!auth.account&&(props.userId?props.userId!==auth.account.oId:props.userName.toLowerCase()!==auth.account.userName.toLowerCase())),pending=computed(()=>operations.commands[targetId.value])
const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId,props.userName,props.userId]);let sequence=0
function clear(){sequence++;targetId.value='';following.value=null;loading.value=false;error.value='';checked.value=false}
async function load(afterWrite=false){if(!visible.value||loading.value)return;const run=++sequence,reader=identity(),valid=()=>visible.value&&run===sequence&&reader===identity();loading.value=true;following.value=null;checked.value=false;error.value=''
 try{const state=await legacyReadUserFollow(props.userName,props.userId);if(valid()){targetId.value=state.targetId;following.value=state.following;checked.value=!!operations.commands[state.targetId]&&!operations.commands[state.targetId]?.busy}}
 catch(e){if(valid())error.value=(afterWrite?'操作已确认，但当前状态读取失败：':'')+(e instanceof Error?e.message:'关注状态读取失败')}
 finally{if(valid())loading.value=false}}
function activate(){if(loading.value||pending.value)return;if(following.value===null){void load();return}if(targetId.value)void operations.set(targetId.value,!following.value)}
function release(){if(checked.value&&!pending.value?.busy){operations.release(targetId.value);checked.value=false}}
watch(identity,()=>{clear();void load()},{flush:'sync'})
watch(()=>operations.lastChange,change=>{if(change.targetId&&(change.targetId===targetId.value||change.targetId===props.userId||!targetId.value)){clear();void load(true)}},{flush:'sync'})
watch(()=>pending.value?.busy,()=>{checked.value=false},{flush:'sync'})
onMounted(()=>{mounted.value=true;void load()});onBeforeUnmount(()=>{mounted.value=false;clear()})
</script>
<template><span v-if="visible" class="user-follow-action"><button type="button" :aria-disabled="loading||!!pending||undefined" :aria-busy="loading||pending?.busy||undefined" @click="activate">{{ pending?'结果待确认':loading?'读取关注状态…':following===null?'重读关注状态':following?'取消关注':'+ 关注' }}</button><span v-if="error||pending?.error" role="status">{{ error||pending?.error }}</span><template v-if="pending&&!pending.busy"><button type="button" :aria-disabled="loading||undefined" @click="!loading&&load()">重读当前关注状态</button><span v-if="checked">当前状态：{{ following?'已关注':'未关注' }}</span><button v-if="checked" type="button" @click="release">我已核对，解除锁定</button></template></span></template>
<style scoped lang="scss">.user-follow-action{display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;max-width:100%}button{border:1px solid var(--fp-border);border-radius:6px;padding:7px 12px;color:var(--fp-text);background:var(--fp-card);cursor:pointer}button[aria-disabled=true]{opacity:.5;cursor:default}span[role=status]{color:#c34a36;overflow-wrap:anywhere}</style>
