<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/stores/chat'

const { onlines } = storeToRefs(useChatStore())
</script>

<template>
  <p class="count">{{ onlines.length }} 人在线</p>
  <ul>
    <li v-for="user in onlines" :key="user.userName">
      <span class="fp-avatar-frame">
        <img class="fp-avatar" :src="user.userAvatarURL || '/favicon.svg'" :alt="user.userName" />
      </span>
      <span>{{ user.userNickname || user.userName }}</span>
    </li>
  </ul>
</template>

<style scoped>
.count {
  margin: 0 0 8px;
  color: var(--fp-muted);
  font-size: 12px;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 280px;
  overflow: auto;
}
li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.fp-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: block;
  object-fit: cover;
}
.fp-avatar-frame {
  position: relative;
  border-radius: 50%;
  display: inline-flex;
}
</style>
