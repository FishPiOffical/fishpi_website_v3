<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { validateRiskCaptcha } from '@/api/fishpi'
import { useGeetest4 } from '@/composables/useGeetest4'
import { registerRiskCaptchaOpener, type CaptchaContext } from '@/utils/riskCaptcha'
import { captchaDiagnostic, captchaDiagnosticError, captchaDiagnosticId } from '@/utils/captchaDiagnostics'
import FpDialog from '@/components/FpDialog.vue'

const open = ref(false)
const tip = ref('')
const busy = ref(false)
const captchaEl = ref<HTMLElement | null>(null)

let resolveWait: (() => void) | null = null
let rejectWait: ((e: Error) => void) | null = null
let generation = 0
const gateId = captchaDiagnosticId('gate')
let context: CaptchaContext | null = null
let submission = 0
let openedAt = 0

function diagnose(event: string, details: Record<string, string | number | boolean | null | undefined> = {}) {
  captchaDiagnostic(event, { ...context, gateId, generation, submission, open: open.value, busy: busy.value, ...details })
}

const { error: gtError, mount: mountGt, destroy: destroyGt } = useGeetest4(captchaEl, (validate) => {
  void onSuccess(validate)
}, diagnose)
watch(gtError, error => { if (error) diagnose('gate.error', { phase: 'widget', reason: 'component-error' }) })

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

async function openGate(nextContext: CaptchaContext): Promise<void> {
  context = nextContext
  submission = 0
  openedAt = performance.now()
  const turn = ++generation
  diagnose('gate.open')
  const pending = new Promise<void>((resolve, reject) => {
    resolveWait = resolve
    rejectWait = reject
  })
  void pending.catch(() => {})
  tip.value = '访问过于频繁，请完成人机验证后继续'
  open.value = true
  await nextTick()
  if (turn !== generation) { diagnose('gate.ignored', { phase: 'open', reason: 'stale-generation' }); return pending }
  destroyGt()
  try {
    diagnose('gate.mount', { phase: 'popup' })
    // 浮动挑战会被 FpDialog 的滚动正文裁切，使用供应商独立弹层。
    await mountGt('popup')
  } catch (e) {
    diagnose('gate.error', { phase: 'mount', ...captchaDiagnosticError(e) })
    tip.value = e instanceof Error ? e.message : '验证码加载失败'
  }
  return pending
}

async function onSuccess(captcha: unknown) {
  diagnose('gate.proof', { hasProof: Boolean(captcha) })
  if (busy.value || !open.value) {
    diagnose('gate.ignored', { phase: 'proof', reason: busy.value ? 'busy' : 'closed' })
    return
  }
  const turn = generation
  const proofContext = { ...context, gateId, generation: turn, submission: ++submission }
  const started = performance.now()
  busy.value = true
  tip.value = '验证中…'
  try {
    diagnose('gate.submit')
    await validateRiskCaptcha(captcha)
    captchaDiagnostic('gate.accepted', { ...proofContext, durationMs: Math.round(performance.now() - started) })
    if (turn !== generation) {
      captchaDiagnostic('gate.ignored', { ...proofContext, phase: 'submit', reason: 'stale-generation' })
      return
    }
    tip.value = '验证通过'
    destroyGt()
    open.value = false
    diagnose('gate.close', { reason: 'success', durationMs: Math.round(performance.now() - openedAt) })
    settleOk()
  } catch (e) {
    captchaDiagnostic('gate.rejected', { ...proofContext, ...captchaDiagnosticError(e), durationMs: Math.round(performance.now() - started) })
    if (turn !== generation) {
      captchaDiagnostic('gate.ignored', { ...proofContext, phase: 'failure', reason: 'stale-generation' })
      return
    }
    tip.value = e instanceof Error ? e.message : '人机验证失败'
    destroyGt()
    await nextTick()
    if (turn !== generation || !open.value) return
    try {
      diagnose('gate.remount', { reason: 'proof-rejected' })
      await mountGt('popup')
    } catch (error) {
      diagnose('gate.error', { phase: 'remount', ...captchaDiagnosticError(error) })
    }
  } finally {
    if (turn === generation) busy.value = false
  }
}

function dismiss() {
  diagnose('gate.close', { reason: 'dismissed', durationMs: Math.round(performance.now() - openedAt) })
  generation++
  busy.value = false
  open.value = false
  destroyGt()
  settleErr(new Error('已取消人机验证'))
}

onMounted(() => {
  diagnose('gate.mounted')
  registerRiskCaptchaOpener(openGate)
})
onUnmounted(() => {
  diagnose('gate.unmounted', { reason: rejectWait ? 'pending' : 'idle' })
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
