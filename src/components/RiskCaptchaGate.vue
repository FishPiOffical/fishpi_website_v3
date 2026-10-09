<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { validateRiskCaptcha } from '@/api/fishpi'
import { useGeetest4 } from '@/composables/useGeetest4'
import { registerRiskCaptchaOpener } from '@/utils/riskCaptcha'

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
  <Teleport v-if="open" to="body">
    <div class="risk-mask" @click.self="dismiss">
      <div class="risk-box" role="dialog" aria-modal="true" aria-labelledby="risk-title">
        <header>
          <strong id="risk-title">安全验证</strong>
          <button type="button" class="x" aria-label="关闭" @click="dismiss">×</button>
        </header>
        <p class="tip">{{ tip }}</p>
        <div ref="captchaEl" class="captcha" />
        <p v-if="gtError" class="err">{{ gtError }}</p>
        <p v-if="busy" class="hint">请稍候…</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.risk-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.55);
}
.risk-box {
  width: min(380px, 100%);
  padding: 18px 18px 16px;
  border-radius: 12px;
  border: 1px solid var(--fp-border);
  background: var(--fp-card);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--fp-title);
}
.x {
  border: 0;
  background: transparent;
  color: var(--fp-muted);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.tip,
.hint {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--fp-muted);
  line-height: 1.5;
}
.captcha {
  min-height: 44px;
}
.err {
  margin: 8px 0 0;
  color: #e07a5f;
  font-size: 13px;
}
</style>
