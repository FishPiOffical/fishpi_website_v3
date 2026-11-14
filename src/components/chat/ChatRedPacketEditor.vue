<script setup lang="ts">
import {computed,nextTick,onBeforeUnmount,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import { userSuggestions, type UserSuggestion } from '@/api/v3-user-suggestions'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatRedPacketsStore} from '@/stores/v3ChatRedPackets'
import {packetInput,packetRisk,type PacketInput,type PacketType} from '@/api/v3-chat-red-packets'
const auth=useAuthStore(),store=useV3ChatRedPacketsStore(),emit=defineEmits<{close:[]}>(),type=ref<PacketType>('random'),money=ref(32),count=ref(2),message=ref('一起摸鱼'),recipients=ref<UserSuggestion[]>([]),gesture=ref<number|string>(''),confirming=ref(false),error=ref('')
const frozen=computed(()=>store.busy||!!store.pending||confirming.value),perShare=computed(()=>type.value==='average'||type.value==='specify')
const packetTypes: { value: PacketType; label: string }[] = [
  { value: 'random', label: '拼手气' },
  { value: 'average', label: '普通' },
  { value: 'specify', label: '专属' },
  { value: 'heartbeat', label: '心跳' },
  { value: 'rockPaperScissors', label: '猜拳' },
]
const hands = [
  { value: 0, label: '石头', image: '/images/redpacket/gesture/rock.png' },
  { value: 1, label: '剪刀', image: '/images/redpacket/gesture/scissors.png' },
  { value: 2, label: '布', image: '/images/redpacket/gesture/paper.png' },
]
const hasShareCount = computed(() => type.value !== 'specify' && type.value !== 'rockPaperScissors')
const totalPoints = computed(() => {
  const shares = type.value === 'specify' ? recipients.value.length : count.value
  if (!Number.isSafeInteger(money.value) || (perShare.value && !Number.isSafeInteger(shares))) return '—'
  const total = perShare.value ? money.value * shares : money.value
  return Number.isSafeInteger(total) && total >= 0 ? total.toLocaleString('zh-CN') : '—'
})
const riskNote = computed(() => {
  if (type.value === 'heartbeat') return '心跳红包可能领取负积分并扣款。'
  if (type.value === 'rockPaperScissors') return '猜拳胜者得奖，败者扣分，平局不增减，税额不退。'
  return ''
})
let abort:AbortController|null=null,submitted=''
const identity=()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||''])
function cancel(){abort?.abort();abort=null;confirming.value=false}
const recipientQuery = ref('')
const recipientInput = ref<HTMLInputElement | null>(null)
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
async function addRecipient(user: UserSuggestion) {
  if (frozen.value || recipients.value.length >= 100 || recipients.value.some(item => item.id === user.id)) return
  recipients.value.push(user)
  recipientQuery.value = ''
  await nextTick()
  recipientInput.value?.focus({ preventScroll: true })
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
watch(type, value => {
  error.value = ''
  gesture.value = ''
  if (value === 'heartbeat' && count.value < 5) count.value = 5
  if (value === 'rockPaperScissors' && money.value < 256) money.value = 256
})
watch(()=>store.completed,command=>{if(command?.kind!=='create'||JSON.stringify(command.input)!==submitted)return;try{if(JSON.stringify(input())===submitted){message.value='';clearRecipients();submitted='';emit('close')}}catch{}})
watch(identity,()=>{cancel();message.value='';clearRecipients();gesture.value='';submitted=''},{flush:'sync'});onBeforeUnmount(cancel)
</script>
<template>
  <form class="packet-editor" @submit.prevent="send">
    <fieldset class="packet-options" :disabled="frozen">
      <legend>红包类型</legend>
      <div class="packet-types">
        <label v-for="option in packetTypes" :key="option.value" class="packet-choice">
          <input v-model="type" type="radio" name="packet-type" :value="option.value" />
          <span>{{ option.label }}</span>
        </label>
      </div>
      <p v-if="riskNote" class="packet-risk">{{ riskNote }}</p>
    </fieldset>

    <div class="packet-amounts" :class="{ 'has-count': hasShareCount }">
      <label class="packet-field">
        <span>{{ perShare ? '每份积分' : '总积分' }}</span>
        <input v-model.number="money" type="number" :min="type === 'rockPaperScissors' ? 256 : 32" max="10240" step="1" :disabled="frozen" required />
      </label>
      <label v-if="hasShareCount" class="packet-field">
        <span>份数</span>
        <input v-model.number="count" type="number" :min="type === 'heartbeat' ? 5 : 1" max="100" step="1" :disabled="frozen" required />
      </label>
    </div>

    <div v-if="type === 'specify'" class="packet-recipients">
      <label class="packet-field">
        <span class="field-label">接收人 <small>{{ recipients.length }} / 100</small></span>
        <input ref="recipientInput" v-model="recipientQuery" placeholder="输入用户名搜索" maxlength="64" autocomplete="off" :disabled="frozen || recipients.length >= 100" @keydown.enter.prevent />
      </label>
      <ul v-if="suggestions.length" class="recipient-results" aria-label="接收人搜索结果">
        <li v-for="user in suggestions" :key="user.id">
          <button type="button" :disabled="frozen" @click="addRecipient(user)">
            <template v-if="user.userNickname && user.userNickname !== user.userName">
              <span>{{ user.userNickname }}</span> <small>@{{ user.userName }}</small>
            </template>
            <span v-else>@{{ user.userName }}</span>
          </button>
        </li>
      </ul>
      <p v-if="recipientStatus" class="field-hint" role="status">{{ recipientStatus }}</p>
      <ul v-if="recipients.length" class="recipient-chips" aria-label="已选接收人">
        <li v-for="user in recipients" :key="user.id">
          <button type="button" :disabled="frozen" :aria-label="`移除 ${user.userName}`" @click="removeRecipient(user.id)">
            <span>@{{ user.userName }}</span><span aria-hidden="true">×</span>
          </button>
        </li>
      </ul>
    </div>

    <fieldset v-if="type === 'rockPaperScissors'" class="packet-options" :disabled="frozen">
      <legend>你的出拳</legend>
      <div class="packet-hands">
        <label v-for="hand in hands" :key="hand.value" class="packet-choice">
          <input v-model="gesture" type="radio" name="packet-gesture" :value="hand.value" required />
          <span><img :src="hand.image" alt="" />{{ hand.label }}</span>
        </label>
      </div>
    </fieldset>

    <label class="packet-field">
      <span class="field-label">留言 <small>选填</small></span>
      <input v-model="message" maxlength="4096" placeholder="写一句祝福" :disabled="frozen" />
    </label>

    <p class="packet-policy">红包未领完不能删除，发出后不会自动到期或退款。</p>
    <p v-if="error" class="packet-error" role="alert">{{ error }}</p>
    <slot name="recovery" />

    <div class="packet-footer">
      <p class="packet-total" aria-live="polite">本次支付 <strong>{{ totalPoints }}</strong> 积分</p>
      <div class="packet-actions">
        <button type="button" class="packet-cancel" @click="emit('close')">取消</button>
        <button type="submit" class="packet-send" :disabled="frozen">{{ frozen ? '正在提交…' : '发红包' }}</button>
      </div>
    </div>
  </form>
</template>

<style scoped lang="scss">
.packet-editor {
  --packet-red: #b64036;
  --packet-selected: color-mix(in srgb, var(--packet-red) 12%, var(--fp-card));
  display: grid;
  gap: 15px;
  min-width: 0;
  color: var(--fp-text);
  font-size: 13px;
}

.packet-options {
  min-inline-size: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.packet-options legend { padding: 0; margin-bottom: 6px; font-weight: 600; }
.packet-types, .packet-hands {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--fp-border);
  border-radius: 9px;
  background: var(--fp-surface-subtle, var(--fp-hover));
}
.packet-hands {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
}
.packet-choice {
  position: relative;
  min-width: 0;

  input {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    clip-path: inset(50%);
  }

  > span {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 38px;
    padding: 0 2px;
    border: 1px solid transparent;
    border-radius: 6px;
    white-space: nowrap;
    color: var(--fp-muted);
    cursor: pointer;
    transition: background-color .15s, border-color .15s;
  }

  input:checked + span {
    border-color: color-mix(in srgb, var(--packet-red) 45%, var(--fp-border));
    background: var(--packet-selected);
    color: var(--fp-title);
    font-weight: 600;
  }
  &:hover input:enabled:not(:checked) + span { background: var(--fp-hover); color: var(--fp-title); }
  input:focus-visible + span { outline: 2px solid var(--packet-red); outline-offset: 1px; }
  input:disabled + span { opacity: .65; cursor: default; }
}
.packet-hands .packet-choice {
  > span { min-height: 46px; border-color: var(--fp-border); }
  img { width: 24px; height: 24px; object-fit: contain; }
}
.packet-risk {
  margin: 8px 0 0;
  padding: 6px 9px;
  border-inline-start: 2px solid #c38a47;
  border-radius: 4px;
  background: color-mix(in srgb, #c38a47 10%, var(--fp-card));
  font-size: 12px;
}

.packet-amounts { display: grid; gap: 12px; }
.packet-amounts.has-count { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.packet-field {
  display: grid;
  gap: 6px;
  min-width: 0;
  font-weight: 600;

  input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 40px;
    padding: 8px 10px;
    border: 1px solid var(--fp-border);
    border-radius: 8px;
    background: var(--fp-surface-subtle, var(--fp-hover));
    color: var(--fp-text);
    font: inherit;
    font-weight: 400;
  }
  input[type='number'] { font-variant-numeric: tabular-nums; }
}
.field-label { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; }
.field-label small, .field-hint { color: var(--fp-muted); font-size: 11px; font-weight: 400; }
.field-hint { margin: 5px 0 0; }
.packet-field input:focus-visible, .packet-editor button:focus-visible {
  outline: 2px solid var(--packet-red);
  outline-offset: 1px;
}

.packet-recipients { min-width: 0; }
.packet-recipients ul { margin: 6px 0 0; padding: 0; list-style: none; }
.recipient-results {
  max-height: 132px;
  overflow: auto;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
}
.recipient-results li + li { border-top: 1px solid var(--fp-border); }
.recipient-results button {
  width: 100%;
  min-height: 34px;
  padding: 6px 9px;
  border: 0;
  background: transparent;
  color: var(--fp-text);
  font: inherit;
  text-align: start;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.recipient-results button:focus-visible { outline-offset: -2px; }
.recipient-results small { color: var(--fp-muted); font-size: 11px; }
.recipient-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-height: 88px;
  overflow: auto;
}
.recipient-chips li { min-width: 0; max-width: 100%; }
.recipient-chips button {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-height: 27px;
  padding: 2px 7px;
  border: 1px solid var(--fp-border);
  border-radius: 6px;
  background: var(--fp-surface-subtle, var(--fp-hover));
  color: var(--fp-text);
  font: inherit;
  font-size: 12px;
  cursor: pointer;

  span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  span:last-child { flex: none; color: var(--fp-muted); }
}
.recipient-results button:enabled:hover, .recipient-chips button:enabled:hover, .packet-cancel:hover {
  background: var(--fp-hover);
}

.packet-policy, .packet-error { margin: 0; font-size: 12px; }
.packet-policy { color: var(--fp-muted); }
.packet-error { color: var(--fp-danger); }
.packet-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding-top: 12px;
  border-top: 1px solid var(--fp-border);
}
.packet-total {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin: 0;
  color: var(--fp-muted);
  font-size: 12px;

  strong { color: var(--fp-title); font-size: 20px; line-height: 1; font-variant-numeric: tabular-nums; }
}
.packet-actions { display: flex; gap: 7px; margin-inline-start: auto; }
.packet-actions button {
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-card);
  color: var(--fp-text);
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
}
.packet-actions .packet-send {
  border-color: transparent;
  background: var(--packet-red);
  color: #fff;
  font-weight: 600;
}
.packet-send:enabled:hover { background: #9f352e; }
.packet-editor button:disabled, .packet-field input:disabled { opacity: .55; cursor: default; }

@media (max-width: 480px) {
  .packet-editor { gap: 12px; }
  .packet-actions button { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .packet-choice > span { transition: none; }
}
</style>
