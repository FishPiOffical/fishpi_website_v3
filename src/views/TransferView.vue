<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { transferPoints } from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'

usePageSeo(() => ({
  title: '积分转账',
  path: '/settings/point',
  robots: 'noindex',
}))

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { apiKey, isLoggedIn, account } = storeToRefs(auth)

const toUser = ref('')
const amount = ref(5)
const memo = ref('请你吃鱼丸')
const busy = ref(false)
const msg = ref('')
const err = ref('')

watch(
  () => route.query.to,
  (v) => {
    if (typeof v === 'string' && v) toUser.value = v
  },
  { immediate: true },
)

async function submit() {
  if (!apiKey.value || !toUser.value.trim()) return
  busy.value = true
  msg.value = ''
  err.value = ''
  try {
    await transferPoints(apiKey.value, toUser.value.trim(), Number(amount.value), memo.value)
    msg.value = '转账成功'
  } catch (e) {
    err.value = e instanceof Error ? e.message : '转账失败'
  } finally {
    busy.value = false
  }
}

function goMember() {
  if (toUser.value.trim()) router.push(`/member/${encodeURIComponent(toUser.value.trim())}`)
}
</script>

<template>
  <section class="card">
    <h1>积分转账</h1>
    <p v-if="!isLoggedIn" class="hint">
      <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>
      后可转账。
    </p>
    <form v-else @submit.prevent="submit">
      <p v-if="account" class="hint">当前余额约 {{ account.userPoint ?? '—' }} 积分</p>
      <label>
        收款用户名
        <input v-model="toUser" required maxlength="64" placeholder="userName" />
      </label>
      <label>
        数量
        <input v-model.number="amount" type="number" min="1" required />
      </label>
      <label>
        备注
        <input v-model="memo" maxlength="64" />
      </label>
      <div class="actions">
        <button type="submit" :disabled="busy">{{ busy ? '提交中…' : '确认转账' }}</button>
        <button type="button" class="ghost" :disabled="!toUser.trim()" @click="goMember">查看主页</button>
        <RouterLink to="/points">查看流水</RouterLink>
      </div>
      <p v-if="msg" class="ok">{{ msg }}</p>
      <p v-if="err" class="err">{{ err }}</p>
    </form>
  </section>
</template>

<style scoped>
.card {
  max-width: 420px;
  margin-inline: auto;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 20px;
}
h1 {
  margin: 0 0 12px;
  font-size: 18px;
}
form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--fp-muted);
}
input {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 8px 10px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
button {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
}
button.ghost {
  background: transparent;
  color: var(--fp-text);
  border: 1px solid var(--fp-border);
}
a {
  color: var(--fp-link);
  font-size: 13px;
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.ok {
  color: var(--fp-green);
  margin: 0;
}
.err {
  color: #e07a5f;
  margin: 0;
}
</style>
