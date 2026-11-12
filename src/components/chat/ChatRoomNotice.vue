<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { ChatRoomNotice } from '@/api/v3-realtime'
import { useV3ChatRedPacketsStore } from '@/stores/v3ChatRedPackets'

defineProps<{ notice: ChatRoomNotice }>()
const packets = useV3ChatRedPacketsStore()
</script>

<template>
  <p class="chat-room-notice" :class="{ 'is-claim': notice.kind === 'claim' }">
    <RouterLink :to="`/member/${notice.actor.userName}`">{{ notice.actor.userNickname || notice.actor.userName }}</RouterLink>
    <template v-if="notice.kind === 'claim'">
      领取了
      <RouterLink :to="`/member/${notice.sender.userName}`">{{ notice.sender.userNickname || notice.sender.userName }}</RouterLink>
      的<button type="button" title="查看红包详情" @click="packets.open(notice.packetId)">红包</button>
      <span>{{ notice.got === notice.count ? '已领完 ' : '' }}{{ notice.got }}/{{ notice.count }}</span>
    </template>
    <template v-else>{{ notice.kind === 'join' ? '进入了聊天室' : '离开了聊天室' }}</template>
  </p>
</template>

<style scoped>
.chat-room-notice {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: baseline;
  gap: 0 4px;
  margin: 0;
  padding: 4px 6px;
  color: var(--fp-muted);
  font-size: 11px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.chat-room-notice a, .chat-room-notice button { color: inherit; font: inherit; }
.chat-room-notice a { text-decoration: none; }
.chat-room-notice button { padding: 0; border: 0; background: none; cursor: pointer; }
.chat-room-notice :is(a, button):hover { text-decoration: underline; }
.is-claim button { color: var(--fp-link); font-weight: 600; }
</style>
