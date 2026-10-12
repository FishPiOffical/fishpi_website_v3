<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import FpDialog from '@/components/FpDialog.vue'

type AlertKind = 'phone' | 'mfa'

const auth = useAuthStore()
const { account } = storeToRefs(auth)

const dismissed = ref(false)

// 与现网一致：优先提示绑手机，其次管理组 2FA
const kind = computed<AlertKind | null>(() => {
  if (account.value?.needBindPhone) return 'phone'
  if (account.value?.need2fa) return 'mfa'
  return null
})

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

function close() {
  dismissed.value = true
}

watch(
  () => account.value?.userName,
  () => {
    dismissed.value = false
  },
)
</script>

<template>
  <FpDialog :open="!dismissed && !!kind" :title="title" tone="danger" @close="close">
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
