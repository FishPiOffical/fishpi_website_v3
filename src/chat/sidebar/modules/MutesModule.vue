<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/stores/chat'

const { mutes } = storeToRefs(useChatStore())
</script>

<template>
  <p v-if="!mutes.length" class="empty">暂无禁言</p>
  <ul v-else>
    <li v-for="item in mutes" :key="item.userName">
      {{ item.userName }}
      <span v-if="item.time">{{ item.time }}</span>
    </li>
  </ul>
</template>

<style scoped>
.empty,
li span {
  color: var(--fp-muted);
  font-size: 12px;
}
ul {
  margin: 0;
  padding-left: 16px;
}
</style>
