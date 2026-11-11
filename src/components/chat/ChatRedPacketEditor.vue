<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import { userSuggestions, type UserSuggestion } from '@/api/v3-user-suggestions'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatRedPacketsStore} from '@/stores/v3ChatRedPackets'
import {packetInput,packetRisk,type PacketInput,type PacketType} from '@/api/v3-chat-red-packets'
const auth=useAuthStore(),store=useV3ChatRedPacketsStore(),emit=defineEmits<{close:[]}>(),type=ref<PacketType>('random'),money=ref(32),count=ref(2),message=ref('一起摸鱼'),recipients=ref<UserSuggestion[]>([]),gesture=ref<number|string>(''),confirming=ref(false),error=ref('')
const frozen=computed(()=>store.busy||!!store.pending||confirming.value),perShare=computed(()=>type.value==='average'||type.value==='specify')
let abort:AbortController|null=null,submitted=''
const identity=()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||''])
function cancel(){abort?.abort();abort=null;confirming.value=false}
const recipientQuery = ref('')
const suggestions = ref<UserSuggestion[]>([])
const recipientStatus = ref('')
watch([recipientQuery, type, identity], ([query, kind], _, onCleanup) => {
  suggestions.value = []
  recipientStatus.value = ''
  const prefix = query.trim().replace(/^@/, '')
  if (kind !== 'specify' || !prefix) return
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(prefix)) {
    recipientStatus.value = '请输入 @ 后面的用户名。'
    return
  }
  const controller = new AbortController()
  const timer = setTimeout(async () => {
    try {
      const matches = await userSuggestions(prefix, controller.signal)
      if (controller.signal.aborted) return
      suggestions.value = matches.filter(user => user.id !== auth.account?.oId && !recipients.value.some(recipient => recipient.id === user.id))
      if (!suggestions.value.length) recipientStatus.value = '没有可添加的接收人。'
    } catch {
      if (!controller.signal.aborted) recipientStatus.value = '暂时无法搜索，请重试。'
    }
  }, 200)
  onCleanup(() => { clearTimeout(timer); controller.abort() })
})
function addRecipient(user: UserSuggestion) {
  if (frozen.value || recipients.value.length >= 100 || recipients.value.some(item => item.id === user.id)) return
  recipients.value.push(user)
  recipientQuery.value = ''
}
function removeRecipient(id: string) {
  recipients.value = recipients.value.filter(user => user.id !== id)
}
function clearRecipients() {
  recipients.value = []
  recipientQuery.value = ''
}
function input():PacketInput{const value:PacketInput={type:type.value,money:money.value,message:message.value};if(type.value==='specify')value.recipientIds=recipients.value.map(user => user.id);else if(type.value!=='rockPaperScissors')value.count=count.value;if(packetRisk(type.value))value.riskAccepted=true;if(type.value==='rockPaperScissors')value.gesture=gesture.value as number;return packetInput(value,auth.account?.oId||'')}
async function send(){if(!auth.accessToken||!auth.account?.oId||frozen.value)return;error.value='';let value:PacketInput;try{if(type.value==='specify' && (!recipients.value.length || recipientQuery.value.trim())) { error.value='请先从搜索结果中选择接收人。'; return } value=input()}catch(e){error.value=e instanceof Error?e.message:'红包参数不合法';return}cancel();const controller=new AbortController();abort=controller;const reader=identity();confirming.value=true
 if(!controller.signal.aborted&&reader===identity()){submitted=JSON.stringify(value);await store.create(value)}if(abort===controller){abort=null;confirming.value=false}}
watch(type,value=>{gesture.value='';if(value==='heartbeat'&&count.value<5)count.value=5;if(value==='rockPaperScissors'&&money.value<256)money.value=256})
watch(()=>store.completed,command=>{if(command?.kind!=='create'||JSON.stringify(command.input)!==submitted)return;try{if(JSON.stringify(input())===submitted){message.value='';clearRecipients();submitted='';emit('close')}}catch{}})
watch(identity,()=>{cancel();message.value='';clearRecipients();gesture.value='';submitted=''},{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template><form class="packet-editor" @submit.prevent="send"><label>类型<select v-model="type" :disabled="frozen"><option value="random">拼手气</option><option value="average">普通</option><option value="specify">专属</option><option value="heartbeat">心跳（可能扣积分）</option><option value="rockPaperScissors">猜拳（可能扣积分）</option></select></label><label>{{ perShare?'每份积分':'总积分' }}<input v-model.number="money" type="number" :min="type==='rockPaperScissors'?256:32" max="10240" step="1" :disabled="frozen" required /></label><label v-if="type!=='specify'&&type!=='rockPaperScissors'">份数<input v-model.number="count" type="number" :min="type==='heartbeat'?5:1" max="100" step="1" :disabled="frozen" required /></label><div v-if="type==='specify'" class="packet-recipients">
  <label>接收人（最多 100 人）<input v-model="recipientQuery" placeholder="输入用户名搜索" maxlength="64" autocomplete="off" :disabled="frozen || recipients.length >= 100" @keydown.enter.prevent /></label>
  <ul v-if="suggestions.length" aria-label="接收人搜索结果"><li v-for="user in suggestions" :key="user.id"><button type="button" :disabled="frozen" @click="addRecipient(user)">{{ user.userNickname || user.userName }} · @{{ user.userName }}</button></li></ul>
  <p v-if="recipientStatus" role="status">{{ recipientStatus }}</p>
  <ul v-if="recipients.length" aria-label="已选接收人"><li v-for="user in recipients" :key="user.id"><button type="button" :disabled="frozen" :aria-label="`移除 ${user.userName}`" @click="removeRecipient(user.id)">@{{ user.userName }} ×</button></li></ul>
</div><label v-if="type==='rockPaperScissors'">发送者出拳<select v-model.number="gesture" :disabled="frozen" required><option value="" disabled>请选择出拳</option><option :value="0">石头</option><option :value="1">剪刀</option><option :value="2">布</option></select></label><label>留言<input v-model="message" maxlength="4096" :disabled="frozen" /></label><p>普通与专属红包按每份金额计算，其他类型按总积分计算。红包未领完不能删除，不自动到期或退款。</p><p>本次支付 {{ perShare ? money * (type === 'specify' ? recipients.length : count) : money }} 积分，实际结算以服务端为准。</p><p v-if="type==='heartbeat' || type==='rockPaperScissors'">{{ type==='heartbeat' ? '心跳红包可能领取负积分并扣款。' : '猜拳胜者得奖，败者扣分，平局不增减，税额不退。' }}</p><p v-if="error" role="alert">{{ error }}</p><div><button type="submit" :disabled="frozen">{{ frozen ? '正在提交…' : '发红包' }}</button><button type="button" @click="emit('close')">取消</button></div></form></template>
<style scoped lang="scss">.packet-editor{display:flex;flex-direction:column;gap:8px;padding:8px 0;min-width:0}label{display:flex;flex-direction:column;gap:4px;font-size:13px}input,select{box-sizing:border-box;width:100%;min-width:0}button,input,select{font:inherit;border:1px solid var(--fp-border);border-radius:5px;padding:6px;background:var(--fp-card);color:var(--fp-text)}button{margin-right:6px}p{font-size:12px;color:var(--fp-muted);margin:0}[role=alert]{color:#bd503c}button:disabled,input:disabled,select:disabled{opacity:.5}
.packet-recipients ul{list-style:none;display:flex;flex-wrap:wrap;gap:5px;margin:6px 0;padding:0}.packet-recipients li{max-width:100%;overflow-wrap:anywhere}
</style>
