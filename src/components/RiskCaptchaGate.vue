<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { validateRiskCaptcha } from '@/api/fishpi'
import { useGeetest4 } from '@/composables/useGeetest4'
import { registerRiskCaptchaOpener } from '@/utils/riskCaptcha'
import FpDialog from '@/components/FpDialog.vue'

const open = ref(false)
const tip = ref('')
const busy = ref(false)
const captchaEl = ref<HTMLElement | null>(null)

let resolveWait: (() => void) | null = null
let rejectWait: ((e: Error) => void) | null = null

const { error: gtError, mount: mountGt, destroy: destroyGt } = useGeetest4(captchaEl, (validate) => {
  void onSuccess(validate)
})

function settleOk() {
  resolveWait?.()
  resolveWait = null
  rejectWait = null
}

function settleErr(e: Error) {
  rejectWait?.(e)
  resolveWait = null
  rejectWait = null
}

async function openGate(): Promise<void> {
  tip.value = '访问过于频繁，请完成人机验证后继续'
  open.value = true
  await nextTick()
  destroyGt()
  try {
    await mountGt('float')
  } catch (e) {
    tip.value = e instanceof Error ? e.message : '验证码加载失败'
  }
  return new Promise<void>((resolve, reject) => {
    resolveWait = resolve
    rejectWait = reject
  })
}

async function onSuccess(captcha: unknown) {
  busy.value = true
  tip.value = '验证中…'
  try {
    await validateRiskCaptcha(captcha)
    tip.value = '验证通过'
    destroyGt()
    open.value = false
    settleOk()
  } catch (e) {
    tip.value = e instanceof Error ? e.message : '人机验证失败'
    destroyGt()
    await nextTick()
    try {
      await mountGt('float')
    } catch {
      /* keep tip */
    }
  } finally {
    busy.value = false
  }
}

function dismiss() {
  open.value = false
  destroyGt()
  settleErr(new Error('已取消人机验证'))
}

onMounted(() => registerRiskCaptchaOpener(openGate))
onUnmounted(() => {
  registerRiskCaptchaOpener(null)
  destroyGt()
  if (rejectWait) settleErr(new Error('人机验证已关闭'))
})
</script>

<template>
  <FpDialog :open="open" title="安全验证" :width="380" layer="top" @close="dismiss">
    <p class="tip">{{ tip }}</p>
    <div ref="captchaEl" class="captcha" />
    <p v-if="gtError" class="err">{{ gtError }}</p>
    <p v-if="busy" class="tip wait">请稍候…</p>
  </FpDialog>
</template>

<style scoped>
.tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--fp-muted);
}
.tip.wait {
  margin: 10px 0 0;
}
.captcha {
  min-height: 44px;
}
.err {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--fp-accent);
}
</style>
