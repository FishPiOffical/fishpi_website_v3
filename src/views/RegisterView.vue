<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { finishRegister, requestSms, verifySms } from '@/api/fishpi'

const router = useRouter()
const step = ref(1)
const userName = ref('')
const userPhone = ref('')
const invitecode = ref('')
const captcha = ref('')
const sms = ref('')
const passwd = ref('')
const role = ref(0)
const referrer = ref('')
const userId = ref('')
const error = ref('')
const loading = ref(false)
const captchaSrc = ref(`/captcha?t=${Date.now()}`)

function refreshCaptcha() {
  captchaSrc.value = `/captcha?t=${Date.now()}`
}

async function sendSms() {
  error.value = ''
  loading.value = true
  try {
    await requestSms({
      userName: userName.value,
      userPhone: userPhone.value,
      captcha: captcha.value,
      invitecode: invitecode.value,
    })
    step.value = 2
  } catch (e) {
    error.value = e instanceof Error ? e.message : '发送失败'
    refreshCaptcha()
  } finally {
    loading.value = false
  }
}

async function checkSms() {
  error.value = ''
  loading.value = true
  try {
    userId.value = await verifySms(sms.value)
    step.value = 3
  } catch (e) {
    error.value = e instanceof Error ? e.message : '验证失败'
  } finally {
    loading.value = false
  }
}

async function complete() {
  error.value = ''
  loading.value = true
  try {
    await finishRegister({
      userId: userId.value,
      passwd: passwd.value,
      userAppRole: role.value,
      referrer: referrer.value || undefined,
    })
    await router.replace('/login')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '注册失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="card" @submit.prevent="step === 1 ? sendSms() : step === 2 ? checkSms() : complete()">
    <h1>注册</h1>
    <p class="hint">走 Rhythm 验证码链路：图形码 → 短信 → 设置密码。</p>

    <template v-if="step === 1">
      <label>用户名<input v-model="userName" required /></label>
      <label>手机号<input v-model="userPhone" required /></label>
      <label>邀请码（可选）<input v-model="invitecode" /></label>
      <label>邀请人用户名（可选）<input v-model="referrer" /></label>
      <div class="captcha">
        <img :src="captchaSrc" alt="验证码" @click="refreshCaptcha" />
        <input v-model="captcha" required placeholder="图形验证码" />
      </div>
      <button type="submit" :disabled="loading">{{ loading ? '发送中…' : '获取短信验证码' }}</button>
    </template>

    <template v-else-if="step === 2">
      <label>短信验证码<input v-model="sms" required /></label>
      <button type="submit" :disabled="loading">{{ loading ? '校验中…' : '下一步' }}</button>
    </template>

    <template v-else>
      <label>密码<input v-model="passwd" type="password" minlength="6" required /></label>
      <label>
        角色
        <select v-model.number="role">
          <option :value="0">黑客</option>
          <option :value="1">画家</option>
        </select>
      </label>
      <button type="submit" :disabled="loading">{{ loading ? '提交中…' : '完成注册' }}</button>
    </template>

    <p v-if="error" class="err">{{ error }}</p>
    <RouterLink to="/login">已有账号，去登录</RouterLink>
  </form>
</template>

<style scoped>
.card {
  max-width: 420px;
  margin: 40px auto;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hint,
label {
  color: var(--fp-muted);
  font-size: 13px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
input,
select {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 8px 10px;
}
.captcha {
  display: flex;
  gap: 8px;
  align-items: center;
}
.captcha img {
  height: 40px;
  border-radius: 6px;
  cursor: pointer;
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
a {
  color: var(--fp-link);
}
</style>
