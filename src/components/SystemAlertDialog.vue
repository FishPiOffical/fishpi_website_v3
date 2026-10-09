<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import FpDialog from '@/components/FpDialog.vue'

type AlertKind = 'phone' | 'mfa'

const auth = useAuthStore()
const { apiKey, isLoggedIn } = storeToRefs(auth)

const open = ref(false)
const kind = ref<AlertKind | null>(null)
const dismissed = ref(false)

const title = computed(() =>
  kind.value === 'mfa' ? '致管理组成员的重要通知' : '系统公告',
)

const body = computed(() => {
  if (kind.value === 'mfa') {
    return '摸鱼派管理组成员，您好！作为管理组的成员，您的账号需要更高的安全性，以确保社区的稳定运行。请您收到此通知后，立即在个人设置-账户中启用两步验证，感谢你对社区的贡献！'
  }
  return '为了确保账号的安全及正常使用，依照相关法规政策要求：您需要绑定手机号后方可正常访问摸鱼派。'
})

const actionTo = computed(() =>
  kind.value === 'mfa' ? '/settings/account#mfaCode' : '/settings/account#bind-phone',
)

const actionLabel = computed(() => (kind.value === 'mfa' ? '前往开启两步验证' : '前往绑定手机'))

async function load() {
  if (import.meta.env.SSR || !apiKey.value || !isLoggedIn.value || dismissed.value) return
  try {
    const res = await fetch('/__fp/security-alerts', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey.value }),
    })
    const data = (await res.json()) as { code?: number; needBindPhone?: boolean; need2fa?: boolean }
    if (!res.ok || data.code) return
    // 与现网一致：优先提示绑手机，其次管理组 2FA
    if (data.needBindPhone) {
      kind.value = 'phone'
      open.value = true
    } else if (data.need2fa) {
      kind.value = 'mfa'
      open.value = true
    }
  } catch {
    /* 探测失败时不打扰 */
  }
}

function close() {
  open.value = false
  dismissed.value = true
}

onMounted(() => {
  void load()
})

watch(isLoggedIn, (v) => {
  if (v) {
    dismissed.value = false
    void load()
  } else {
    open.value = false
    kind.value = null
  }
})
</script>

<template>
  <FpDialog :open="open && !!kind" :title="title" tone="danger" @close="close">
    <p class="body">{{ body }}</p>
    <template #footer>
      <button type="button" class="fp-btn" @click="close">稍后再说</button>
      <RouterLink class="fp-btn fp-btn--primary" :to="actionTo" @click="close">{{ actionLabel }}</RouterLink>
    </template>
  </FpDialog>
</template>

<style scoped>
.body {
  margin: 0;
}
</style>
