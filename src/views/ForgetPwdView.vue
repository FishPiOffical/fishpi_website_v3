<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { requestForgetPwd } from '@/api/fishpi'
import { useGeetest4 } from '@/composables/useGeetest4'
import { usePageSeo } from '@/composables/usePageSeo'

usePageSeo(() => ({
  title: '忘记密码',
  path: '/forget-pwd',
  robots: 'noindex',
}))

const router = useRouter()
const phone = ref('')
const smsCode = ref('')
const step = ref<'phone' | 'sms'>('phone')
const tip = ref('')
const err = ref('')
const busy = ref(false)
const captchaEl = ref<HTMLElement | null>(null)

const { error: gtError, mount: mountGt, destroy: destroyGt } = useGeetest4(captchaEl, (validate) => {
  void onCaptchaSuccess(validate)
})

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
    destroyGt()
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
  void mountGt().catch((e) => {
    err.value = e instanceof Error ? e.message : '验证码加载失败'
  })
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
      <p v-if="gtError" class="err">{{ gtError }}</p>
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
  box-shadow: var(--fp-card-shadow);
  border-radius: var(--fp-radius-lg, 10px);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
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
input:not([type='checkbox']):not([type='radio']) {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: var(--fp-radius-md, 8px);
  padding: 8px 12px;
  outline: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}
input:not([type='checkbox']):not([type='radio']):hover {
  border-color: var(--fp-border-strong, var(--fp-border));
}
input:not([type='checkbox']):not([type='radio']):focus {
  border-color: var(--fp-primary);
  box-shadow: var(--fp-focus-ring);
}
.captcha {
  min-height: 44px;
}
.primary {
  border: 1px solid var(--fp-primary);
  background: var(--fp-primary);
  color: #fff;
  border-radius: var(--fp-radius-sm, 6px);
  padding: 8px 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}
.primary:hover {
  background: var(--fp-primary-hover, var(--fp-primary));
  border-color: var(--fp-primary-hover, var(--fp-primary));
  box-shadow: 0 4px 12px color-mix(in srgb, var(--fp-primary) 28%, transparent);
}
.ok {
  margin: 0;
  color: var(--fp-primary);
  font-size: 13px;
}
.err {
  margin: 0;
  color: var(--fp-danger, #e07a5f);
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
