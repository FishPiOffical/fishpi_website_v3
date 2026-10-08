<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { requestForgetPwd } from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'

usePageSeo(() => ({
  title: '忘记密码',
  path: '/forget-pwd',
  robots: 'noindex',
}))

const GEETEST_ID = '6d886bcaec3f86fcfd6f61bff5af2cb4'

const router = useRouter()
const phone = ref('')
const smsCode = ref('')
const step = ref<'phone' | 'sms'>('phone')
const tip = ref('')
const err = ref('')
const busy = ref(false)
const captchaEl = ref<HTMLElement | null>(null)

type GtInstance = {
  appendTo: (el: string | HTMLElement) => GtInstance
  onSuccess: (cb: () => void) => GtInstance
  getValidate: () => unknown
  reset: () => void
  destroy?: () => void
}

let gt: GtInstance | null = null

function loadGeetest(): Promise<void> {
  const w = window as Window & { initGeetest4?: (cfg: object, cb: (g: GtInstance) => void) => void }
  if (w.initGeetest4) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://static.geetest.com/v4/gt4.js'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('GeeTest 脚本加载失败'))
    document.head.appendChild(s)
  })
}

async function mountCaptcha() {
  if (!captchaEl.value || step.value !== 'phone') return
  await loadGeetest()
  const w = window as Window & { initGeetest4?: (cfg: object, cb: (g: GtInstance) => void) => void }
  if (!w.initGeetest4) throw new Error('GeeTest 不可用')
  captchaEl.value.innerHTML = ''
  w.initGeetest4({ captchaId: GEETEST_ID, product: 'float' }, (instance) => {
    gt = instance
    instance.appendTo(captchaEl.value!).onSuccess(() => {
      void onCaptchaSuccess(instance.getValidate())
      setTimeout(() => instance.reset(), 3000)
    })
  })
}

async function onCaptchaSuccess(captcha: unknown) {
  const p = phone.value.trim()
  if (!/^1\d{10}$/.test(p)) {
    err.value = '手机号码不合法'
    return
  }
  busy.value = true
  err.value = ''
  tip.value = ''
  try {
    tip.value = await requestForgetPwd(p, captcha)
    step.value = 'sms'
  } catch (e) {
    err.value = e instanceof Error ? e.message : '发送失败'
  } finally {
    busy.value = false
  }
}

function goReset() {
  const code = smsCode.value.trim()
  if (!code) {
    err.value = '请输入短信验证码'
    return
  }
  void router.push({ path: '/reset-pwd', query: { code } })
}

onMounted(() => {
  void mountCaptcha().catch((e) => {
    err.value = e instanceof Error ? e.message : '验证码加载失败'
  })
})

onUnmounted(() => {
  try {
    gt?.destroy?.()
  } catch {
    /* ignore */
  }
  gt = null
})
</script>

<template>
  <section class="card">
    <h1>忘记密码</h1>
    <p class="hint">通过绑定手机号找回。完成人机验证后将发送短信验证码。</p>

    <template v-if="step === 'phone'">
      <label>
        手机号码
        <input v-model="phone" type="tel" maxlength="11" placeholder="手机号码" autocomplete="tel" autofocus />
      </label>
      <div ref="captchaEl" class="captcha" />
      <p v-if="busy" class="hint">发送中…</p>
    </template>

    <template v-else>
      <p v-if="tip" class="ok">{{ tip }}</p>
      <label>
        短信验证码
        <input v-model="smsCode" maxlength="16" placeholder="短信验证码" autocomplete="one-time-code" />
      </label>
      <button type="button" class="primary" @click="goReset">验证并重置密码</button>
    </template>

    <p v-if="err" class="err">{{ err }}</p>
    <p class="links">
      <RouterLink to="/login">返回登录</RouterLink>
      <RouterLink to="/register">注册</RouterLink>
    </p>
  </section>
</template>

<style scoped>
.card {
  max-width: 380px;
  margin: 40px auto;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
h1 {
  margin: 0;
  font-size: 20px;
  color: var(--fp-title);
}
.hint {
  margin: 0;
  font-size: 13px;
  color: var(--fp-muted);
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
  border-radius: 6px;
  padding: 8px 10px;
}
.captcha {
  min-height: 44px;
}
.primary {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
}
.ok {
  margin: 0;
  color: var(--fp-primary);
  font-size: 13px;
}
.err {
  margin: 0;
  color: #e07a5f;
  font-size: 13px;
}
.links {
  display: flex;
  gap: 12px;
  font-size: 13px;
}
.links a {
  color: var(--fp-link);
}
</style>
