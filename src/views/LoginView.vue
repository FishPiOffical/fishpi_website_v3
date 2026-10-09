<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { validateRiskCaptcha } from '@/api/fishpi'
import { isCaptchaRequired } from '@/api/http'
import { useGeetest4 } from '@/composables/useGeetest4'
import { useAuthStore } from '@/stores/auth'
import { useAppearanceStore } from '@/stores/appearance'

const LAST_USER = 'fp.lastUser'
const username = ref(typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_USER) || '' : '')
const passwd = ref('')
const mfa = ref('')
const showKeyLogin = ref(false)
const apiKeyInput = ref('')
const needCaptcha = ref(false)
const captchaTip = ref('')
const verifying = ref(false)
const captchaEl = ref<HTMLElement | null>(null)
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

const { error: gtError, mount: mountGt, destroy: destroyGt } = useGeetest4(captchaEl, (validate) => {
  void onCaptchaSuccess(validate)
})

async function showCaptcha(message?: string) {
  needCaptcha.value = true
  captchaTip.value = message || '访问过于频繁，请完成人机验证后再登录'
  await nextTick()
  destroyGt()
  try {
    await mountGt('float')
  } catch (e) {
    captchaTip.value = e instanceof Error ? e.message : '验证码加载失败'
  }
}

async function onCaptchaSuccess(captcha: unknown) {
  verifying.value = true
  captchaTip.value = '验证中…'
  try {
    await validateRiskCaptcha(captcha)
    needCaptcha.value = false
    captchaTip.value = '验证通过，正在登录…'
    destroyGt()
    if (showKeyLogin.value) await submitKey(true)
    else await submit(true)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '人机验证失败'
    captchaTip.value = msg
    await showCaptcha(msg)
  } finally {
    verifying.value = false
  }
}

if (auth.isLoggedIn) void router.replace(redirectTarget())

async function submit(skipCaptchaGate = false) {
  try {
    await auth.login(username.value, passwd.value, mfa.value)
    localStorage.setItem(LAST_USER, username.value)
    await afterLogin()
  } catch (e) {
    if (!skipCaptchaGate && isCaptchaRequired(e)) {
      await showCaptcha(e instanceof Error ? e.message : undefined)
      return
    }
    /* 错误已写在 auth.error */
  }
}

async function submitKey(skipCaptchaGate = false) {
  try {
    await auth.loginWithApiKey(apiKeyInput.value)
    await afterLogin()
  } catch (e) {
    if (!skipCaptchaGate && isCaptchaRequired(e)) {
      await showCaptcha(e instanceof Error ? e.message : undefined)
      return
    }
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

    <div v-if="needCaptcha" class="captcha-block">
      <p class="hint">{{ captchaTip || '请完成人机验证' }}</p>
      <div ref="captchaEl" class="captcha" />
      <p v-if="gtError" class="err">{{ gtError }}</p>
      <button type="button" class="linkish" @click="showCaptcha()">重新加载验证码</button>
    </div>

    <p v-if="auth.error && !needCaptcha" class="err">{{ auth.error }}</p>
    <button type="submit" :disabled="auth.loading || verifying || needCaptcha">
      {{
        verifying || auth.loading
          ? '登录中…'
          : needCaptcha
            ? '请先完成上方验证'
            : showKeyLogin
              ? '使用 apiKey 进入'
              : '登录'
      }}
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
button[type='submit']:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.linkish {
  border: 0;
  background: transparent;
  color: var(--fp-link);
  cursor: pointer;
  padding: 0;
  font: inherit;
  font-size: 13px;
  text-align: left;
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
.captcha-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px dashed var(--fp-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--fp-accent) 6%, transparent);
}
.captcha {
  min-height: 44px;
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
