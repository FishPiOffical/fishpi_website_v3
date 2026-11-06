<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { isNavigationFailure, RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppearanceStore } from '@/stores/appearance'

const LAST_USER = 'fp.lastUser'
function rememberedUser() { try { return typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_USER) || '' : '' } catch { return '' } }
const username = ref(rememberedUser())
const passwd = ref('')
const mfa = ref('')
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const appearance = useAppearanceStore()
const submitting=ref(false),returning=ref(false),returnError=ref('')
const busy=computed(()=>submitting.value||returning.value||auth.loading)
const securityNotice = computed(() => route.query.reason === 'security-updated' ? '账号安全设置已更新，现有登录授权已失效，请重新登录。' : route.query.reason === 'security-unconfirmed' ? '安全设置请求结果未确认，请重新登录核实；修改密码时请尝试新密码，必要时再核对原密码。' : '')

function redirectTarget() {
  return typeof route.query.redirect === 'string' ? route.query.redirect : '/'
}

async function afterLogin() {
  if (returning.value || !auth.isLoggedIn) return
  returning.value=true;returnError.value=''
  try {
    appearance.enforceVip()
    const failure=await router.replace(redirectTarget())
    if(isNavigationFailure(failure))returnError.value='页面打开失败，请重试打开原页面。'
  } catch { returnError.value='页面打开失败，请重试打开原页面。' }
  finally { returning.value=false }
}

onMounted(()=>{if(auth.isLoggedIn)void afterLogin()})

async function submit() {
  if(busy.value||auth.isLoggedIn)return
  submitting.value=true
  try {
    await auth.login(username.value, passwd.value, mfa.value)
    passwd.value='';mfa.value=''
    try { localStorage.setItem(LAST_USER, username.value) } catch { /* Remembering a username is optional. */ }
    await afterLogin()
  } catch {
    /* Authentication errors are displayed by the auth store. */
  } finally { submitting.value=false }
}

</script>

<template>
  <form v-if="!auth.isLoggedIn" class="card" @submit.prevent="submit">
    <h1>登录</h1>
    <p v-if="securityNotice" role="status">{{ securityNotice }}</p>
    <label>用户名或邮箱<input v-model="username" required autocomplete="username" /></label>
    <label>密码<input v-model="passwd" type="password" required autocomplete="current-password" /></label>
    <label>两步验证（可选）<input v-model="mfa" /></label>
    <p v-if="auth.error" class="err">{{ auth.error }}</p>
    <button type="submit" :disabled="busy">
      {{ busy ? '登录中…' : '登录' }}
    </button>
    <p class="links">
      <RouterLink to="/register">注册</RouterLink>
      <RouterLink to="/forget-pwd">忘记密码</RouterLink>
      <RouterLink to="/agreement">用户协议</RouterLink>
      <RouterLink to="/download">客户端</RouterLink>
    </p>
  </form>
  <section v-else class="card" aria-label="登录成功">
    <h1>登录已成功</h1>
    <p v-if="returning" role="status">正在打开原页面…</p>
    <p v-if="returnError" class="err" role="alert">{{ returnError }}</p>
    <button type="button" :disabled="returning" @click="afterLogin">重试打开原页面</button>
  </section>
</template>

<style scoped>
.card {
  max-width: 380px;
  margin: 40px auto;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  box-shadow: var(--fp-card-shadow);
  border-radius: var(--fp-radius-lg, 10px);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--fp-muted);
}
input:not([type='checkbox']):not([type='radio']),
textarea {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: var(--fp-radius-md, 8px);
  padding: 8px 12px;
  font: inherit;
  resize: vertical;
  outline: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}
input:not([type='checkbox']):not([type='radio']):hover,
textarea:hover {
  border-color: var(--fp-border-strong, var(--fp-border));
}
input:not([type='checkbox']):not([type='radio']):focus,
textarea:focus {
  border-color: var(--fp-primary);
  box-shadow: var(--fp-focus-ring);
}
button[type='submit'] {
  border: 1px solid var(--fp-primary);
  background: var(--fp-primary);
  color: #fff;
  border-radius: var(--fp-radius-sm, 6px);
  padding: 9px 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}
button[type='submit']:hover:not(:disabled) {
  background: var(--fp-primary-hover, var(--fp-primary));
  border-color: var(--fp-primary-hover, var(--fp-primary));
  box-shadow: 0 4px 12px color-mix(in srgb, var(--fp-primary) 28%, transparent);
}
button[type='submit']:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
