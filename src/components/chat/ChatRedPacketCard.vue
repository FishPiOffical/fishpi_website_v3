<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import HongbaoCard from './HongbaoCard.vue'
import type { RedPacketContent } from '@/api/fishpi'
import { getAuthContextVersion } from '@/api/http'
import { PACKET_TYPES, packetRisk, type ClaimInput, type PacketType } from '@/api/v3-chat-red-packets'
import { useAuthStore } from '@/stores/auth'
import { useV3ChatRedPacketsStore } from '@/stores/v3ChatRedPackets'

const props = defineProps<{ packetId: string; packet: RedPacketContent }>()
const auth = useAuthStore()
const store = useV3ChatRedPacketsStore()
const userId = computed(() => auth.account?.oId || '')
const identity = () => [getAuthContextVersion(), !!auth.accessToken, userId.value, props.packetId].join(':')
const checking = ref(false)
const detailsOnly = ref(false)
const notice = ref('')
let check: AbortController | null = null

const outcome = computed(() => {
  const receipt = store.receipt
  if (receipt?.kind !== 'claim' || receipt.data.id !== props.packetId || !receipt.data.outcome) return ''
  const { amount, outcome } = receipt.data
  return `${{ win: '获胜', lose: '惜败', tie: '平局' }[outcome]} · ${amount > 0 ? '+' : ''}${amount} 积分`
})

function cancelCheck() {
  check?.abort()
  check = null
  checking.value = false
}

function hasPendingClaim() {
  const command = store.pending
  return command?.kind === 'claim' && command.id === props.packetId
}

async function open(gesture?: number) {
  const type = props.packet.type as PacketType
  const packetComplete = Number(props.packet.count) > 0 && Number(props.packet.got) >= Number(props.packet.count)
  const selfRestricted = props.packet.senderId === userId.value && (type === 'specify' || type === 'rockPaperScissors')
  if (!auth.accessToken || !userId.value || !PACKET_TYPES.includes(type) || packetComplete
      || detailsOnly.value || outcome.value || selfRestricted
      || type === 'rockPaperScissors' && gesture === undefined) {
    void store.open(props.packetId)
    return
  }
  if (checking.value || store.pending || store.busy) return
  const controller = new AbortController()
  check = controller
  checking.value = true
  notice.value = ''
  try {
    const input: ClaimInput = {}
    if (packetRisk(type)) input.riskAccepted = true
    if (type === 'rockPaperScissors') input.gesture = gesture
    const result = await store.claimFromCard(props.packetId, type, input)
    if (controller.signal.aborted) return
    if (result?.kind === 'claim') {
      detailsOnly.value = true
    } else if (hasPendingClaim()) {
      notice.value = '领取结果尚未确认，请打开此红包恢复原操作'
    } else if (store.error) {
      notice.value = store.error
    }
  } catch {
    if (!controller.signal.aborted) notice.value = '暂时无法领取红包，请重试'
  } finally {
    if (check === controller) cancelCheck()
  }
}

watch(identity, () => {
  cancelCheck()
  detailsOnly.value = false
  notice.value = ''
}, { flush: 'sync' })
onBeforeUnmount(cancelCheck)
</script>

<template>
  <HongbaoCard
    :packet="packet"
    :user-id="userId"
    :is-sender="packet.senderId === userId"
    :details-only="!auth.accessToken || !userId || !packet.senderId || detailsOnly || !!outcome"
    :gestures-disabled="checking || store.busy || !!store.pending"
    @open="open"
  />
  <div v-if="checking || notice || outcome" class="packet-status" role="status">{{ checking ? '正在领取…' : notice || outcome }}</div>
</template>

<style scoped>
.packet-status { margin: 4px 0; color: var(--fp-muted); font-size: 12px; }
</style>
