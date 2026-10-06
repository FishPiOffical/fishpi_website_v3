<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppearanceStore } from '@/stores/appearance'

const LAST_USER = 'fp.lastUser'
const username = ref(localStorage.getItem(LAST_USER) || '')
const passwd = ref('')
const mfa = ref('')
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const appearance = useAppearanceStore()

async function submit() {
  try {
    await auth.login(username.value, passwd.value, mfa.value)
    localStorage.setItem(LAST_USER, username.value)
    appearance.enforceVip()
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch {
    /* 错误已写在 auth.error */
  }
}
</script>

<template>
  <form class="card" @submit.prevent="submit">
    <h1>登录</h1>
    <label>用户名或邮箱<input v-model="username" required /></label>
    <label>密码<input v-model="passwd" type="password" required /></label>
    <label>两步验证（可选）<input v-model="mfa" /></label>
    <p v-if="auth.error" class="err">{{ auth.error }}</p>
    <button type="submit" :disabled="auth.loading">{{ auth.loading ? '登录中…' : '登录' }}</button>
  </form>
</template>

<style scoped>
.card {
  max-width: 360px;
  margin: 40px auto;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 24px;
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
button {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
}
.err {
  color: #e07a5f;
  margin: 0;
}
</style>
