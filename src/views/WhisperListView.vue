<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useWhisperStore } from '@/stores/whispers'

const auth = useAuthStore()
const whispers = useWhisperStore()
const router = useRouter()
const { account } = storeToRefs(auth)
const { list, loading, error, usingMock } = storeToRefs(whispers)
const toUser = ref('')
const me = computed(() => account.value?.userName || '')

onMounted(() => void whispers.loadList())

function peer(msg: (typeof list.value)[number]) {
  return whispers.peerOf(msg, me.value)
}

function go() {
  const name = toUser.value.trim()
  if (name) router.push(`/chat/${encodeURIComponent(name)}`)
}
</script>

<template>
  <section class="card">
    <h1>私信</h1>
    <p v-if="usingMock" class="hint">GET /chat/get-list 未返回数据时展示约定字段 mock。</p>
    <form class="start" @submit.prevent="go">
      <input v-model="toUser" placeholder="用户名" />
      <button type="submit" :disabled="!toUser.trim()">发起会话</button>
    </form>
    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <ol v-else>
      <li v-if="!list.length" class="hint">还没有私信</li>
      <li v-for="item in list" :key="item.oId">
        <RouterLink :to="`/chat/${peer(item)}`">
          <img class="fp-avatar" :src="item.senderUserName === me ? item.receiverAvatar : item.senderAvatar || '/favicon.svg'" alt="" />
          <div>
            <b>{{ peer(item) }}</b>
            <p>{{ item.preview || item.markdown || '…' }}</p>
            <time>{{ item.time }}</time>
          </div>
        </RouterLink>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 18px 20px;
  max-width: 720px;
}
h1 {
  margin: 0 0 12px;
  font-size: 18px;
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.err {
  color: #e07a5f;
}
.start {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}
.start input {
  flex: 1;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 8px 10px;
}
.start button {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
}
ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
li a {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--fp-border);
  color: inherit;
  text-decoration: none;
}
.fp-avatar {
  width: 40px;
  height: 40px;
}
b {
  display: block;
}
p {
  margin: 4px 0;
  font-size: 14px;
}
time {
  color: var(--fp-muted);
  font-size: 12px;
}
</style>
