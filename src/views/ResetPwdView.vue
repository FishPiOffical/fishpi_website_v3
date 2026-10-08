<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { fetchResetPwdMeta, resetPassword } from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'

usePageSeo(() => ({
  title: '重置密码',
  path: '/reset-pwd',
  robots: 'noindex',
}))

const route = useRoute()
const router = useRouter()
const userId = ref('')
const code = ref('')
const passwd = ref('')
const passwd2 = ref('')
const err = ref('')
const msg = ref('')
const loading = ref(true)
const busy = ref(false)

onMounted(async () => {
  const q = typeof route.query.code === 'string' ? route.query.code.trim() : ''
  if (!q) {
    err.value = '缺少短信验证码，请先完成忘记密码流程'
    loading.value = false
    return
  }
  try {
    const meta = await fetchResetPwdMeta(q)
    userId.value = meta.userId
    code.value = meta.code
  } catch (e) {
    err.value = e instanceof Error ? e.message : '验证码无效'
  } finally {
    loading.value = false
  }
})

async function submit() {
  err.value = ''
  msg.value = ''
  if (passwd.value.length < 6 || passwd.value.length > 20) {
    err.value = '密码长度需为 6–20 位'
    return
  }
  if (passwd.value !== passwd2.value) {
    err.value = '两次输入的密码不一致'
    return
  }
  if (!userId.value || !code.value) {
    err.value = '验证信息缺失，请重新找回密码'
    return
  }
  busy.value = true
  try {
    await resetPassword(userId.value, code.value, passwd.value)
    msg.value = '密码已重置，正在前往登录…'
    setTimeout(() => {
      void router.replace('/login')
    }, 800)
  } catch (e) {
    err.value = e instanceof Error ? e.message : '重置失败'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card">
    <h1>重置密码</h1>
    <p v-if="loading" class="hint">校验短信验证码…</p>
    <p v-else-if="userId === 'mock-reset-user-id'" class="hint">
      重置元数据接口未开放，当前为假数据（见 docs/MISSING_APIS.md），提交现网会失败。
    </p>
    <form v-else-if="userId" class="form" @submit.prevent="submit">
      <label>
        新密码
        <input v-model="passwd" type="password" required minlength="6" maxlength="20" autocomplete="new-password" />
      </label>
      <label>
        确认密码
        <input v-model="passwd2" type="password" required minlength="6" maxlength="20" autocomplete="new-password" />
      </label>
      <button type="submit" class="primary" :disabled="busy">{{ busy ? '提交中…' : '确认重置' }}</button>
    </form>
    <p v-if="msg" class="ok">{{ msg }}</p>
    <p v-if="err" class="err">{{ err }}</p>
    <p class="links">
      <RouterLink to="/forget-pwd">重新找回</RouterLink>
      <RouterLink to="/login">登录</RouterLink>
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
.form {
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
  border-radius: 6px;
  padding: 8px 10px;
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
