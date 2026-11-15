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
let generation = 0

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
  const turn = ++generation
  const pending = new Promise<void>((resolve, reject) => {
    resolveWait = resolve
    rejectWait = reject
  })
  void pending.catch(() => {})
  tip.value = '访问过于频繁，请完成人机验证后继续'
  open.value = true
  await nextTick()
  if (turn !== generation) return pending
  destroyGt()
  try {
    // 浮动挑战会被 FpDialog 的滚动正文裁切，使用供应商独立弹层。
    await mountGt('popup')
  } catch (e) {
    tip.value = e instanceof Error ? e.message : '验证码加载失败'
  }
  return pending
}

async function onSuccess(captcha: unknown) {
  if (busy.value || !open.value) return
  const turn = generation
  busy.value = true
  tip.value = '验证中…'
  try {
    await validateRiskCaptcha(captcha)
    if (turn !== generation) return
    tip.value = '验证通过'
    destroyGt()
    open.value = false
    settleOk()
  } catch (e) {
    if (turn !== generation) return
    tip.value = e instanceof Error ? e.message : '人机验证失败'
    destroyGt()
    await nextTick()
    if (turn !== generation || !open.value) return
    try {
      await mountGt('popup')
    } catch {
      /* keep tip */
    }
  } finally {
    if (turn === generation) busy.value = false
  }
}

function dismiss() {
  generation++
  busy.value = false
  open.value = false
  destroyGt()
  settleErr(new Error('已取消人机验证'))
}

onMounted(() => registerRiskCaptchaOpener(openGate))
onUnmounted(() => {
  generation++
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
