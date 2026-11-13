<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import FpDialog from '@/components/FpDialog.vue'
import { useGeetest4 } from '@/composables/useGeetest4'
import { usePetsStore } from '@/stores/pets'
import PetIcon from './PetIcon.vue'

const pets = usePetsStore()
const captchaEl = ref<HTMLElement | null>(null), panel = ref<HTMLElement | null>(null), now = ref(Date.now())
const captcha = useGeetest4(captchaEl, value => { void pets.submitRiskProof(value) })
const remaining = computed(() => Math.max(0, Math.ceil((pets.riskUntil - now.value) / 1000)))
const ready = computed(() => pets.riskStage === 'ready' && !remaining.value)
const problem = computed(() => {
  const value = pets.riskError || captcha.error.value
  return /JSON|HTTP|SQL|fetch|network|token|stack|接口|数据格式/i.test(value) ? '暂时无法完成验证，请稍后再试。' : value
})
let timer: ReturnType<typeof setInterval> | undefined, opener: HTMLElement | null = null, sequence = 0
function trap(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const dialog = panel.value?.closest('[role="dialog"]')
  const nodes = [...dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]') || []].filter(node => node.getClientRects().length)
  const first = nodes[0], last = nodes.at(-1)
  if (!first) { event.preventDefault(); panel.value?.focus() }
  else if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
watch(() => pets.riskOpen, async open => {
  const run = ++sequence
  if (timer) { clearInterval(timer); timer = undefined }
  if (!open) {
    captcha.destroy()
    document.removeEventListener('keydown', trap)
    await nextTick()
    if (run === sequence && opener?.isConnected) opener.focus()
    return
  }
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  now.value = Date.now()
  timer = setInterval(() => { now.value = Date.now() }, 1000)
  document.addEventListener('keydown', trap)
  await nextTick()
  if (run === sequence) panel.value?.focus()
})
watch(() => pets.riskChallenge, async challenge => {
  captcha.destroy()
  if (!challenge || !pets.riskOpen || pets.offline) return
  await nextTick()
  if (pets.riskChallenge === challenge && pets.riskOpen) await captcha.mount('float', challenge.captchaId)
}, { flush: 'post' })
onBeforeUnmount(() => {
  sequence++
  if (timer) clearInterval(timer)
  document.removeEventListener('keydown', trap)
  pets.closeRisk()
})
</script>

<template>
  <FpDialog :open="pets.riskOpen" title="宠物操作验证" :width="420" layer="top" @close="pets.closeRisk()">
    <section ref="panel" class="pet-risk" tabindex="-1" :aria-busy="pets.riskBusy || pets.busy">
      <div class="pet-risk-heading"><PetIcon :name="ready ? 'check' : 'lock'" /><strong>{{ ready ? '可以继续了' : remaining ? '稍等一下' : pets.riskStage === 'cooldown' ? '等待已结束' : '请完成安全验证' }}</strong></div>
      <p>{{ pets.pendingUncertain ? '上次操作的结果仍待确认，继续时会先核对原操作。' : '上次操作已保留，确认继续后才会执行。' }}</p>
      <p v-if="remaining" role="status">{{ remaining }} 秒后可继续。</p>
      <p v-else-if="pets.offline" role="status">网络已断开，请联网后继续。</p>
      <p v-else-if="pets.riskBusy" role="status">{{ pets.riskChallenge ? '正在核对验证结果…' : '正在准备验证…' }}</p>
      <div v-show="pets.riskChallenge && !pets.offline" ref="captchaEl" class="pet-risk-captcha" />
      <p v-if="problem" class="pet-risk-error" role="alert">{{ problem }}</p>
      <div class="pet-risk-actions">
        <button type="button" :disabled="pets.busy" @click="pets.closeRisk()">稍后处理</button>
        <button v-if="ready" type="button" class="pet-risk-primary" :disabled="pets.busy || pets.riskBusy || pets.offline" @click="pets.retryPending()">{{ pets.busy ? '正在处理…' : '继续原操作' }}</button>
        <button v-else-if="!pets.riskChallenge || problem" type="button" class="pet-risk-primary" :disabled="pets.busy || pets.riskBusy || pets.offline || remaining > 0" @click="pets.prepareRisk()">{{ pets.riskStage === 'cooldown' ? '核对状态' : problem ? '重新验证' : '继续验证' }}</button>
      </div>
      <button v-if="!pets.pendingUncertain" type="button" class="pet-risk-discard" :disabled="pets.busy || remaining > 0" @click="pets.cancelRejectedOperation()">放弃本次操作</button>
    </section>
  </FpDialog>
</template>

<style scoped>
.pet-risk { display: grid; gap: 14px; outline: none; }
.pet-risk-heading { display: flex; align-items: center; gap: 9px; color: var(--fp-title); }
.pet-risk-heading svg { color: var(--fp-primary); }
.pet-risk p { margin: 0; color: var(--fp-muted); font-size: 13px; line-height: 1.7; }
.pet-risk .pet-risk-error { color: var(--fp-danger); }
.pet-risk-captcha { min-height: 44px; max-width: 100%; }
.pet-risk-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px; }
.pet-risk-actions button { min-height: 40px; padding: 8px 14px; border: 1px solid var(--fp-border); border-radius: 8px; background: var(--fp-card); color: var(--fp-text); font: inherit; font-size: 13px; cursor: pointer; }
.pet-risk-actions .pet-risk-primary { background: var(--fp-primary); border-color: transparent; color: #fff; }
.pet-risk-discard { justify-self: center; border: 0; background: transparent; color: var(--fp-muted); padding: 4px; font-size: 12px; cursor: pointer; }
.pet-risk button:disabled { opacity: .5; cursor: default; }
.pet-risk button:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
@media (max-width: 600px) { .pet-risk-actions button { min-height: 44px; } }
</style>
