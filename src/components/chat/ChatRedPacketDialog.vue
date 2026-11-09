<script setup lang="ts">
import { formatDateTime } from '@/utils/time'

import {computed,onBeforeUnmount,ref,watch} from 'vue'
import { RouterLink } from 'vue-router'
import { avatarUrl, DEFAULT_AVATAR } from '@/utils/avatar'
import FpDialog from '@/components/FpDialog.vue'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatRedPacketsStore} from '@/stores/v3ChatRedPackets'
import {getAuthContextVersion} from '@/api/http'
import {packetRisk,type ClaimInput} from '@/api/v3-chat-red-packets'
const auth=useAuthStore(),store=useV3ChatRedPacketsStore(),gesture=ref<number|string>(''),confirming=ref(false),localError=ref('')
const canClaim=computed(()=>{const d=store.detail;return!!d&&!d.legacy&&!d.currentUserClaim&&d.got<d.count&&!(d.type==='rockPaperScissors'&&d.sender.id===auth.account?.oId)})
let abort:AbortController|null=null
function cancel(){abort?.abort();abort=null;confirming.value=false}
const identity=()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||''])
async function claim(){const d=store.detail;if(!d||d.legacy||!canClaim.value||store.busy||store.pending||confirming.value)return;localError.value='';if(d.type==='rockPaperScissors'&&!(typeof gesture.value==='number'&&Number.isInteger(gesture.value)&&gesture.value>=0&&gesture.value<=2)){localError.value='请先明确选择出拳';return}cancel();const controller=new AbortController();abort=controller;const reader=identity(),choice=gesture.value;confirming.value=true
 if(!controller.signal.aborted&&reader===identity()&&store.detail===d){const input:ClaimInput={};if(packetRisk(d.type))input.riskAccepted=true;if(d.type==='rockPaperScissors')input.gesture=choice as number;await store.claim(d.id,d.type,input)}if(abort===controller){abort=null;confirming.value=false}}
watch(()=>store.detail,()=>{cancel();gesture.value='';localError.value=''});watch(identity,cancel,{flush:'sync'});onBeforeUnmount(cancel)
const hands=[{value:0,label:'石头',image:'/images/redpacket/gesture/rock.png'},{value:1,label:'剪刀',image:'/images/redpacket/gesture/scissors.png'},{value:2,label:'布',image:'/images/redpacket/gesture/paper.png'}] as const
const hand=(g:number)=>hands[g]?.label||'未知'
const detail=computed(()=>store.detail)
const isDuel=computed(()=>detail.value?.type==='rockPaperScissors')
const typeLabel=computed(()=>detail.value?({random:'拼手气红包',average:'普通红包',specify:'专属红包',heartbeat:'心跳红包',rockPaperScissors:'猜拳红包',dice:'骰子红包'})[detail.value.type]:'红包详情')
const progress=computed(()=>detail.value?Math.min(100,detail.value.got/detail.value.count*100):0)
const opponentHand=computed(()=>detail.value?.claims[0]?.gesture??(typeof gesture.value==='number'?gesture.value:undefined))
const duelResult=computed(()=>{
 const d=detail.value,result=d?.currentUserClaim?.outcome||d?.claims[0]?.outcome
 if(!result)return''
 return d?.sender.id===auth.account?.oId?({win:'挑战方胜出',lose:'发起方胜出',tie:'双方平局'})[result]:({win:'你赢了',lose:'这次惜败',tie:'平局'})[result]
})
function selectHand(value:number){if(store.busy||store.pending||confirming.value)return;gesture.value=value;localError.value='';void claim()}
const signed=(amount:number)=>amount>0?`+${amount}`:String(amount)
const resultLabel=(result?:string)=>({win:'获胜',lose:'失利',tie:'平局'}[result||'']||'已结算')
function fallback(event:Event){const img=event.target as HTMLImageElement;if(img.getAttribute('src')!==DEFAULT_AVATAR)img.src=DEFAULT_AVATAR}
</script>

<template>
  <FpDialog :open="!!store.selectedId" :title="typeLabel" :width="520" @close="store.close">
    <template #title><span class="packet-dialog-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 3h14v18H5z M5 8l7 4 7-4 M9 15h6" /></svg>{{ typeLabel }}<span v-if="detail">红包详情</span></span></template>
    <div v-if="store.loading" class="packet-state" role="status"><span class="state-symbol" aria-hidden="true">🧧</span><p>正在读取红包…</p></div>
    <div v-else-if="store.detailError" class="packet-state is-error" role="alert"><span class="state-symbol" aria-hidden="true">!</span><h3>暂时无法查看红包</h3><p>{{ store.detailError }}</p><button type="button" class="subtle-button" @click="store.open()">重试红包详情</button></div>
    <div v-else-if="detail" class="packet-detail" :class="{'is-duel':isDuel}">
      <section class="packet-hero" :class="{'has-claim':detail.currentUserClaim}">
        <div class="sender-line">
          <RouterLink v-if="detail.sender.userName" :to="`/member/${encodeURIComponent(detail.sender.userName)}`" :data-user-card="detail.sender.userName" class="sender-avatar" @click="store.close" :aria-label="`查看 ${detail.sender.userNickname||detail.sender.userName} 的主页`"><img :src="avatarUrl(detail.sender)" alt="" @error="fallback" /></RouterLink>
          <img v-else class="sender-avatar" :src="avatarUrl(detail.sender)" alt="" @error="fallback" />
          <span>{{ detail.sender.userNickname||detail.sender.userName||detail.sender.id }}<small>的红包</small></span>
        </div>
        <h2>{{ detail.message||typeLabel }}</h2>
        <div v-if="detail.currentUserClaim" class="claim-result" aria-live="polite">
          <strong>{{ signed(detail.currentUserClaim.amount) }}</strong><span>积分</span>
          <p>{{ detail.currentUserClaim.amount<0?'本次扣款':isDuel&&duelResult?duelResult:'已领取' }}</p>
        </div>
        <p v-else class="hero-caption">{{ isDuel?'石头 · 剪刀 · 布，一局定胜负':detail.got===detail.count?'红包已领完':'祝你收获一份好手气' }}</p>
      </section>

      <div class="packet-stats">
        <div><span>已领取</span><strong>{{ detail.got }}<small> / {{ detail.count }} 份</small></strong></div>
        <div v-if="detail.legacy && detail.money!==undefined"><span>{{ detail.type==='average'||detail.type==='specify'?'每份积分':'红包积分' }}</span><strong>{{ detail.money }}<small> 积分</small></strong></div>
        <div v-if="!detail.legacy"><span>初始奖池</span><strong>{{ detail.poolPoints }}<small> 积分</small></strong></div>
        <div v-if="!detail.legacy"><span>税额</span><strong>{{ detail.taxPoints }}<small> 积分</small></strong></div>
      </div>
      <div class="claim-progress" role="progressbar" aria-label="红包领取进度" :aria-valuenow="detail.got" :aria-valuemin="0" :aria-valuemax="detail.count"><i :style="{width:`${progress}%`}" /></div>

      <section v-if="isDuel && !detail.legacy" class="duel-section" aria-label="猜拳对局">
        <div class="duel-arena">
          <div class="duel-player"><span>发起方</span><img v-if="detail.senderGesture!==undefined" :src="hands[detail.senderGesture]?.image" :alt="hand(detail.senderGesture)" /><span v-else class="unknown-hand" aria-label="出拳尚未揭晓">?</span><small>{{ detail.senderGesture!==undefined?hand(detail.senderGesture):'待揭晓' }}</small></div>
          <div class="duel-center"><span>VS</span><small v-if="duelResult">{{ duelResult }}</small><small v-else>{{ detail.poolPoints }} 积分对局</small></div>
          <div class="duel-player"><span>{{ detail.got?'挑战方':'你的出拳' }}</span><img v-if="opponentHand!==undefined" :src="hands[opponentHand]?.image" :alt="hand(opponentHand)" /><span v-else class="unknown-hand" aria-label="尚未选择出拳">?</span><small>{{ opponentHand!==undefined?hand(opponentHand):'等待出拳' }}</small></div>
        </div>
        <div v-if="canClaim" class="hand-picker" role="group" aria-label="选择出拳并领取">
          <button v-for="option in hands" :key="option.value" type="button" :aria-pressed="gesture===option.value" :disabled="store.busy||!!store.pending||confirming" @click="selectHand(option.value)"><img :src="option.image" alt="" /><span>{{ option.label }} · 领取</span><i v-if="gesture===option.value" aria-hidden="true">✓</i></button>
        </div>
        <p v-if="canClaim" class="risk-note">胜得 {{ detail.poolPoints }}，负扣 {{ detail.poolPoints }}，平局不增减。领取前余额需至少 {{ detail.poolPoints }} 积分。</p>
        <p v-else-if="detail.sender.id===auth.account?.oId&&!detail.got" class="quiet-note">这是你发起的挑战，等待其他鱼油出拳。</p>
      </section>
      <p v-else-if="canClaim&&detail.type==='heartbeat'" class="risk-note">心跳红包可能领取负积分并扣款，领取前余额需至少 {{ detail.poolPoints }} 积分。</p>

      <div v-if="canClaim && !isDuel" class="claim-action"><button type="button" class="claim-button" :disabled="store.busy||!!store.pending||confirming" @click="claim">{{ store.busy?'正在领取…':confirming?'等待确认…':detail.type==='heartbeat'?'接受扣分风险并领取':'领取一份' }}</button></div>
      <p v-if="store.pending" class="quiet-note" role="status">有红包操作结果待确认，请先通过红包操作提示恢复原操作。</p>
      <p v-if="localError||store.error" class="inline-error" role="alert">{{ localError||store.error }}</p>

      <section class="claim-records" aria-label="红包领取记录">
        <header><h3>领取记录 <span>{{ detail.got }}</span></h3><button type="button" class="refresh-button" :disabled="store.loading" @click="store.open()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-2l2 2 M4 17l2 2a7 7 0 0 0 12-2" /></svg>刷新详情</button></header>
        <ul v-if="detail.claims.length"><li v-for="row in detail.claims" :key="row.user.id">
          <RouterLink v-if="row.user.userName" :to="`/member/${encodeURIComponent(row.user.userName)}`" :data-user-card="row.user.userName" class="record-avatar" @click="store.close" :aria-label="`查看 ${row.user.userNickname||row.user.userName} 的主页`"><img :src="avatarUrl(row.user)" alt="" @error="fallback" /></RouterLink><img v-else class="record-avatar" :src="avatarUrl(row.user)" alt="" @error="fallback" />
          <div class="record-person"><strong>{{ row.user.userNickname||row.user.userName||row.user.id }}</strong><time v-if="row.claimedAt">{{ formatDateTime(row.claimedAt) }}</time><small v-if="row.gesture!==undefined" class="record-duel">{{ hand(row.gesture) }} · {{ resultLabel(row.outcome) }}<span v-if="row.senderRefundPoints!==undefined"> · 退回发送者 {{ row.senderRefundPoints }} 积分</span></small></div>
          <div class="record-amount" :class="{'is-debit':row.amount<0}"><strong>{{ signed(row.amount) }}</strong><small>{{ row.amount<0?'积分 · 扣款':'积分' }}</small></div>
        </li></ul>
        <p v-else class="records-empty">{{ detail.got===detail.count?'红包已领完':'还没有人领取，等一份好手气。' }}</p>
      </section>
      <details v-if="detail.recipientIds?.length" class="recipients"><summary>指定接收人 · {{ detail.recipientIds.length }} 人</summary><p>{{ detail.recipientIds.join('、') }}</p></details>
      <p v-if="detail.legacy" class="packet-footnote">经典红包 · 仅查看领取记录</p>
      <p v-else class="packet-footnote">{{ detail.got===detail.count?'红包已领完 · ':'' }}查看详情不会领取，领取结果以实际结算为准。</p>
    </div>
    <div v-else class="packet-state"><p>红包详情尚未就绪。</p></div>
  </FpDialog>
</template>

<style scoped lang="scss">
.packet-dialog-title { display:flex; align-items:center; gap:8px; svg { width:19px; height:19px; color:#c4513f; } >span { margin-left:2px; font-size:11px; font-weight:400; color:var(--fp-muted); } }
.packet-detail { min-width:0; overflow-wrap:anywhere; }
.packet-hero { position:relative; overflow:hidden; padding:20px 20px 23px; border-radius:12px; text-align:center; color:#fff3dc; background:linear-gradient(135deg,#c95843,#b53935); &::before,&::after { content:''; position:absolute; width:160px; height:160px; border:1px solid rgba(255,225,171,.13); border-radius:50%; pointer-events:none; } &::before { left:-105px; top:-80px; width:260px; height:260px; } &::after { right:-90px; bottom:-100px; width:240px; height:240px; } h2 { position:relative; margin:15px 0 9px; color:inherit; font-size:22px; font-weight:600; line-height:1.4; letter-spacing:.03em; } }
.sender-line { display:flex; align-items:center; justify-content:center; gap:8px; font-size:13px; small { margin-left:4px; color:#f2c6b2; } }
.sender-avatar { display:block; flex:none; width:28px; height:28px; border:1px solid rgba(255,232,192,.5); border-radius:var(--fp-avatar-radius); object-fit:cover; img { display:block; width:100%; height:100%; border-radius:inherit; object-fit:cover; } }
.hero-caption { margin:0; color:#f6d2bb; font-size:12px; }
.claim-result { position:relative; margin:9px 0 0; >strong { font-size:42px; font-weight:600; font-variant-numeric:tabular-nums; line-height:1.2; color:#ffe0a0; } >span { margin-left:6px; font-size:12px; color:#ffe0a0; } p { margin:5px 0 0; font-size:12px; color:#f6d2bb; } }
.packet-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; padding:17px 0 12px; >div { display:flex; flex-direction:column; gap:4px; text-align:center; } span { font-size:11px; color:var(--fp-muted); } strong { font-size:17px; font-weight:600; color:var(--fp-title); font-variant-numeric:tabular-nums; } small { font-size:11px; font-weight:400; color:var(--fp-muted); } }
.claim-progress { height:3px; overflow:hidden; border-radius:3px; background:var(--fp-hover); i { display:block; height:100%; border-radius:inherit; background:#d1a36b; transition:width .2s ease; } }
.duel-section { margin-top:16px; }
.duel-arena { display:grid; grid-template-columns:minmax(0,1fr) auto minmax(0,1fr); gap:14px; align-items:center; padding:2px 12px 13px; }
.duel-player { display:flex; min-width:0; flex-direction:column; align-items:center; gap:5px; >span:first-child { font-size:11px; color:var(--fp-muted); } img,.unknown-hand { width:42px; height:42px; object-fit:contain; } small { font-size:11px; color:var(--fp-text); } .unknown-hand { display:grid; place-items:center; font-size:27px; font-weight:500; color:var(--fp-muted); background:var(--fp-hover); border-radius:50%; } }
.duel-center { display:flex; flex-direction:column; gap:6px; text-align:center; >span { color:#c29867; font-size:19px; font-weight:600; font-style:italic; } small { font-size:11px; color:var(--fp-muted); } }
.hand-picker { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; button { position:relative; display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px 8px; border:1px solid var(--fp-border); border-radius:10px; background:var(--fp-card); color:var(--fp-text); font-size:12px; cursor:pointer; transition:border-color .15s,background-color .15s; } img { width:38px; height:38px; object-fit:contain; } button:hover:not(:disabled) { background:var(--fp-hover); border-color:#d5ac77; } button[aria-pressed='true'] { border-color:#cb975c; background:color-mix(in srgb,#cfa468 10%,var(--fp-card)); box-shadow:inset 0 0 0 1px #cb975c; } i { position:absolute; top:5px; right:7px; font-size:11px; font-style:normal; color:#b78046; } }
.risk-note { margin:12px 0 0; padding:9px 11px; border-radius:7px; border-left:2px solid #d7ad71; background:color-mix(in srgb,#d5a767 8%,var(--fp-card)); color:var(--fp-text); font-size:11px; line-height:1.65; }
.claim-action { margin:16px 0 4px; }
.claim-button { display:block; width:100%; min-height:42px; border:1px solid #d5a56e; border-radius:9px; background:linear-gradient(110deg,#f0d2a3,#e4b97e); color:#6f391e; font-size:14px; font-weight:600; cursor:pointer; transition:filter .15s; &:hover:not(:disabled) { filter:brightness(1.04); } }
button:disabled { opacity:.55; cursor:default; }
.claim-records { margin-top:20px; header { display:flex; align-items:center; justify-content:space-between; gap:10px; padding-bottom:9px; border-bottom:1px solid var(--fp-border); } h3 { margin:0; font-size:13px; font-weight:600; color:var(--fp-title); span { margin-left:4px; font-size:11px; font-weight:400; color:var(--fp-muted); } } ul { list-style:none; margin:0; padding:0; max-height:220px; overflow:auto; } li { display:flex; align-items:center; gap:10px; padding:12px 0; border-bottom:1px solid var(--fp-divider,var(--fp-border)); &:last-child { border:0; } } }
.refresh-button,.subtle-button { display:inline-flex; align-items:center; gap:4px; padding:5px 7px; border:0; border-radius:6px; background:transparent; color:var(--fp-muted); font-size:11px; cursor:pointer; &:hover:not(:disabled) { background:var(--fp-hover); color:var(--fp-title); } svg { width:13px; height:13px; } }
.record-avatar { display:block; flex:none; width:28px; height:28px; border-radius:var(--fp-avatar-radius); object-fit:cover; img { display:block; width:100%; height:100%; border-radius:inherit; object-fit:cover; } }
.record-person { display:flex; min-width:0; flex:1; flex-direction:column; gap:3px; strong { color:var(--fp-title); font-size:12px; font-weight:500; } time,.record-duel { color:var(--fp-muted); font-size:10px; line-height:1.5; } }
.record-amount { display:flex; flex:none; flex-direction:column; align-items:flex-end; gap:3px; color:#b78244; strong { font-size:17px; font-weight:600; font-variant-numeric:tabular-nums; } small { font-size:10px; color:var(--fp-muted); } &.is-debit { color:#c45c4c; } }
.records-empty { margin:0; padding:21px 8px; text-align:center; color:var(--fp-muted); font-size:12px; }
.recipients { margin-top:12px; color:var(--fp-muted); font-size:11px; summary { cursor:pointer; } p { margin:8px 0; } }
.packet-footnote,.quiet-note { margin:12px 0 0; color:var(--fp-muted); font-size:11px; line-height:1.6; }
.packet-footnote { text-align:center; }
.inline-error { margin:10px 0 0; color:var(--fp-danger,#bc5142); font-size:12px; }
.packet-state { min-height:180px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:9px; text-align:center; p { margin:0; font-size:13px; color:var(--fp-muted); } h3 { margin:0; font-size:15px; color:var(--fp-title); } .state-symbol { display:grid; place-items:center; width:48px; height:48px; border-radius:50%; background:var(--fp-hover); font-size:28px; color:var(--fp-muted); } }
@media(max-width:480px) { .packet-hero { padding:16px 12px 18px; h2 { font-size:19px; } }.packet-stats strong { font-size:15px; }.duel-arena { gap:8px; padding-right:2px; padding-left:2px; }.hand-picker { gap:6px; }.record-duel { max-width:190px; }.claim-records { margin-top:16px; } }
@media(prefers-reduced-motion:reduce) { * { transition:none!important; } }
</style>
