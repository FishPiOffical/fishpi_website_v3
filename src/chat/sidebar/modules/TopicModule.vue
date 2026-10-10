<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useChatStore } from '@/stores/chat'

const chat = useChatStore()
const { discuss } = storeToRefs(chat)
const draft = ref('')

function save() {
  if (!draft.value.trim()) return
  void chat.setDiscuss(draft.value.trim())
  draft.value = ''
}
</script>

<template>
  <p class="topic"># {{ discuss }} #</p>
  <form class="row" @submit.prevent="save">
    <input v-model="draft" placeholder="设置新话题" />
    <button type="submit">更新</button>
  </form>
</template>

<style scoped>
.topic {
  margin: 0 0 10px;
  padding: 9px 11px;
  border-left: 3px solid var(--fp-primary);
  border-radius: 5px;
  background: var(--fp-hover);
  color: var(--fp-primary);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
  word-break: break-all;
}
.row {
  display: flex;
  gap: 6px;
}
input {
  flex: 1;
  min-width: 0;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 6px;
  padding: 6px 8px;
}
button {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
}
</style>
