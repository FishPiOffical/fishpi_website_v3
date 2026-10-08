<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppearanceStore } from '@/stores/appearance'

const LAST_USER = 'fp.lastUser'
const username = ref(typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_USER) || '' : '')
const passwd = ref('')
const mfa = ref('')
const showKeyLogin = ref(false)
const apiKeyInput = ref('')
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const appearance = useAppearanceStore()

function redirectTarget() {
  return typeof route.query.redirect === 'string' ? route.query.redirect : '/'
}

async function afterLogin() {
  appearance.enforceVip()
  await router.replace(redirectTarget())
}

onMounted(() => {
  if (auth.isLoggedIn) void router.replace(redirectTarget())
})

async function submit() {
  try {
    await auth.login(username.value, passwd.value, mfa.value)
    localStorage.setItem(LAST_USER, username.value)
    await afterLogin()
  } catch {
    /* 错误已写在 auth.error */
  }
}

async function submitKey() {
  try {
    await auth.loginWithApiKey(apiKeyInput.value)
    await afterLogin()
  } catch {
    /* auth.error */
  }
}
</script>

<template>
  <form class="card" @submit.prevent="showKeyLogin ? submitKey() : submit()">
    <h1>登录</h1>
    <template v-if="!showKeyLogin">
      <label>用户名或邮箱<input v-model="username" required autocomplete="username" /></label>
      <label>密码<input v-model="passwd" type="password" required autocomplete="current-password" /></label>
      <label>两步验证（可选）<input v-model="mfa" /></label>
    </template>
    <template v-else>
      <label>
        apiKey
        <textarea v-model="apiKeyInput" rows="3" required placeholder="粘贴已有 apiKey，不会调用密码登录接口" />
      </label>
      <p class="hint">浏览器会把 apiKey 存到 localStorage（<code>fp.apiKey</code>），下次自动恢复，无需再输密码。</p>
    </template>
    <p v-if="auth.error" class="err">{{ auth.error }}</p>
    <button type="submit" :disabled="auth.loading">
      {{ auth.loading ? '登录中…' : showKeyLogin ? '使用 apiKey 进入' : '登录' }}
    </button>
    <p class="links">
      <button type="button" class="linkish" @click="showKeyLogin = !showKeyLogin">
        {{ showKeyLogin ? '改用账号密码' : '已有 apiKey？' }}
      </button>
      <RouterLink to="/register">注册</RouterLink>
      <RouterLink to="/forget-pwd">忘记密码</RouterLink>
      <RouterLink to="/agreement">用户协议</RouterLink>
      <RouterLink to="/download">客户端</RouterLink>
    </p>
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
input,
textarea {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
  resize: vertical;
}
button[type='submit'] {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
}
.linkish {
  border: 0;
  background: transparent;
  color: var(--fp-link);
  cursor: pointer;
  padding: 0;
  font: inherit;
}
.err {
  color: #e07a5f;
  font-size: 13px;
}
.hint {
  margin: 0;
  font-size: 12px;
  color: var(--fp-muted);
  line-height: 1.45;
}
.hint code {
  font-size: 11px;
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
}
.links a {
  color: var(--fp-link);
  text-decoration: none;
}
</style>
