<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { RouterLink } from 'vue-router'
import { useChatStore } from '@/stores/chat'

const { mutes } = storeToRefs(useChatStore())
</script>

<template>
  <p v-if="!mutes.length" class="empty">当前没有被禁言的成员</p>
  <ul v-else>
    <li v-for="item in mutes" :key="item.userName">
      <RouterLink :to="`/member/${item.userName}`">{{ item.userName }}</RouterLink>
      <span v-if="item.time">{{ item.time }}</span>
    </li>
  </ul>
</template>

<style scoped>
.empty { margin: 0; padding: 8px 10px; border-radius: 5px; background: var(--fp-bg); color: var(--fp-muted); font-size: 12px; }
ul { margin: 0; padding: 0; list-style: none; max-height: 200px; overflow: auto; scrollbar-width: thin; }
li { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 8px; padding: 7px 0; }
li + li { border-top: 1px solid var(--fp-border); }
li a { min-width: 0; overflow-wrap: anywhere; color: var(--fp-text); font-size: 12px; text-decoration: none; }
li a:hover { text-decoration: underline; }
li span { color: var(--fp-muted); font-size: 11px; }
</style>
