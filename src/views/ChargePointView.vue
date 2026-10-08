<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { request } from '@/api/http'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'

usePageSeo(() => ({
  title: '捐助摸鱼派',
  path: '/charge/point',
  robots: 'noindex',
}))

const route = useRoute()
const auth = useAuthStore()
const { isLoggedIn } = storeToRefs(auth)

const money = ref('6')
const note = ref('支持摸鱼派')
const busy = ref(false)
const err = ref('')
const qr = ref('')

async function payWechat() {
  err.value = ''
  qr.value = ''
  const amount = Number(money.value)
  if (!note.value.trim()) {
    err.value = '请填写捐助附言'
    return
  }
  if (!Number.isFinite(amount) || amount < 1) {
    err.value = '捐助金额需大于等于 1'
    return
  }
  busy.value = true
  try {
    const data = await request<{ QRcode_url?: string; code?: number; msg?: string }>(
      `/pay/wechat?total_amount=${encodeURIComponent(String(amount))}&note=${encodeURIComponent(note.value.trim())}`,
    )
    if (data.QRcode_url) qr.value = data.QRcode_url
    else throw new Error(data.msg || '未返回支付二维码')
  } catch (e) {
    err.value = e instanceof Error ? e.message : '发起支付失败'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card">
    <h1>❤️ 捐助摸鱼派</h1>
    <p>
      摸鱼派是以「摸鱼」为社区精神的科技社区。捐助将用于社区运营。也可在设置里使用积分转账互赠鱼丸。
    </p>
    <p v-if="!isLoggedIn" class="hint">
      <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>
      后可发起微信捐助。
    </p>
    <template v-else>
      <label>
        捐助金额（元）
        <input v-model="money" type="number" min="1" step="1" />
      </label>
      <label>
        捐助附言（最多 32 字）
        <input v-model="note" maxlength="32" />
      </label>
      <button type="button" class="primary" :disabled="busy" @click="payWechat">
        {{ busy ? '请求中…' : '使用微信捐助' }}
      </button>
      <p v-if="err" class="err">{{ err }}</p>
      <div v-if="qr" class="qr">
        <img :src="qr" width="200" height="200" alt="微信支付二维码" />
        <p class="hint">请使用微信扫码支付，完成后刷新本页即可。</p>
        <button type="button" class="ghost" @click="qr = ''">关闭</button>
      </div>
    </template>
    <p class="links">
      <RouterLink to="/settings/point">积分转账</RouterLink>
      <RouterLink to="/points">积分流水</RouterLink>
    </p>
  </section>
</template>

<style scoped>
.card {
  max-width: 520px;
  margin: 24px auto;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
h1 {
  margin: 0;
  font-size: 20px;
  color: var(--fp-title);
}
p {
  margin: 0;
  line-height: 1.6;
  color: var(--fp-text);
  font-size: 14px;
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
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
  align-self: flex-end;
  border: 0;
  background: #44b549;
  color: #fff;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
}
.ghost {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-muted);
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
}
.err {
  color: #e07a5f;
  font-size: 13px;
}
.qr {
  text-align: center;
  padding: 12px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
}
.links {
  display: flex;
  gap: 14px;
  font-size: 13px;
}
.links a {
  color: var(--fp-link);
}
</style>
