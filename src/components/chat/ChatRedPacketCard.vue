<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import HongbaoCard from './HongbaoCard.vue'
import type { RedPacketContent } from '@/api/fishpi'
import { getAuthContextVersion } from '@/api/http'
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

async function open(gesture?: number) {
  if (gesture === undefined) {
    void store.open(props.packetId, true)
    return
  }
  if (checking.value || store.pending || store.busy) return
  const controller = new AbortController()
  check = controller
  checking.value = true
  notice.value = ''
  try {
    const result = await store.claimDuelFromCard(props.packetId, gesture, controller.signal)
    if (controller.signal.aborted) return
    if (result === 'details') {
      detailsOnly.value = true
      notice.value = '此红包当前无法出拳，可查看详情'
    } else if (result === 'busy') {
      notice.value = '请先完成当前红包操作'
    } else if (result?.kind === 'claim') {
      detailsOnly.value = true
    }
  } catch {
    if (!controller.signal.aborted) notice.value = '暂时无法核对红包，请重试'
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
  <div v-if="checking || notice || outcome" class="packet-status" role="status">{{ checking ? '正在核对红包…' : notice || outcome }}</div>
</template>

<style scoped>
.packet-status { margin: 4px 0; color: var(--fp-muted); font-size: 12px; }
</style>
