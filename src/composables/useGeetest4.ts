import { onUnmounted, ref, type Ref } from 'vue'

/** FishPi / Rhythm 现网 GeeTest4 captchaId（与 forget-pwd / settings 一致）。 */
export const FISHPI_GEETEST_ID = '6d886bcaec3f86fcfd6f61bff5af2cb4'

export type Geetest4Instance = {
  appendTo: (el: string | HTMLElement) => Geetest4Instance
  onSuccess: (cb: () => void) => Geetest4Instance
  getValidate: () => unknown
  reset: () => void
  destroy?: () => void
  onReady?: (cb: () => void) => Geetest4Instance
  onError?: (cb: (error: { code?: unknown }) => void) => Geetest4Instance
  onClose?: (cb: () => void) => Geetest4Instance
  onFail?: (cb: () => void) => Geetest4Instance
}

type InitFn = (cfg: object, cb: (g: Geetest4Instance) => void) => void

let scriptFlight: Promise<InitFn> | null = null
function loadScript(): Promise<InitFn> {
  const w = window as Window & { initGeetest4?: InitFn }
  if (w.initGeetest4) return Promise.resolve(w.initGeetest4)
  if (scriptFlight) return scriptFlight
  const promise = new Promise<InitFn>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-fp-geetest4]')
    const script = existing || document.createElement('script')
    const fail = () => { script.remove(); reject(new Error('GeeTest 脚本加载失败，请重试')) }
    script.addEventListener('load', () => { const init = (window as Window & { initGeetest4?: InitFn }).initGeetest4; if (init) resolve(init); else fail() }, { once: true })
    script.addEventListener('error', fail, { once: true })
    if (!existing) { script.src = 'https://static.geetest.com/v4/gt4.js'; script.async = true; script.dataset.fpGeetest4 = '1'; document.head.appendChild(script) }
  })
  scriptFlight = promise
  void promise.catch(() => { if (scriptFlight === promise) scriptFlight = null })
  return promise
}

export function useGeetest4(container: Ref<HTMLElement | null>, onSuccess: (validate: unknown) => void,
  diagnose?: (event: string, fields: Record<string, string | number | boolean>) => void) {
  const ready = ref(false)
  const error = ref('')
  let gt: Geetest4Instance | null = null
  let generation = 0
  const timers = new Set<ReturnType<typeof setTimeout>>()

  async function mount(product: 'float' | 'popup' = 'float', captchaId = FISHPI_GEETEST_ID) {
    destroy()
    const current = ++generation, target = container.value
    diagnose?.('widget.mount', { widgetGeneration: current, phase: product, ready: Boolean(target) })
    error.value = ''
    if (!target) {
      error.value = '验证码容器未就绪'
      diagnose?.('widget.error', { widgetGeneration: current, reason: 'container-missing' })
      return
    }
    try {
      const init = await loadScript()
      diagnose?.('widget.script', { widgetGeneration: current, reason: 'loaded' })
      if (current !== generation || container.value !== target) {
        diagnose?.('widget.stale', { widgetGeneration: current, phase: 'script' })
        return
      }
      target.innerHTML = ''
      ready.value = false
      init({ captchaId, product }, (instance) => {
        if (current !== generation || container.value !== target) {
          diagnose?.('widget.stale', { widgetGeneration: current, phase: 'init' })
          instance.destroy?.(); return
        }
        gt = instance
        instance.onReady?.(() => diagnose?.('widget.vendor-ready', { widgetGeneration: current }))
        instance.onError?.(failure => diagnose?.('widget.error', {
          widgetGeneration: current, reason: 'vendor-error',
          vendorCode: typeof failure?.code === 'number' || typeof failure?.code === 'string' && /^\d{1,10}$/.test(failure.code) ? String(failure.code) : 'unknown',
        }))
        instance.onClose?.(() => diagnose?.('widget.close', { widgetGeneration: current }))
        instance.onFail?.(() => diagnose?.('widget.fail', { widgetGeneration: current }))
        instance.appendTo(target).onSuccess(() => {
          if (current !== generation || container.value !== target || gt !== instance) {
            diagnose?.('widget.stale', { widgetGeneration: current, phase: 'success' })
            return
          }
          const proof = instance.getValidate()
          diagnose?.('widget.success', { widgetGeneration: current, hasProof: Boolean(proof) })
          onSuccess(proof)
          const timer = setTimeout(() => {
            timers.delete(timer)
            if (current === generation && gt === instance) {
              diagnose?.('widget.reset', { widgetGeneration: current, reason: 'success-timer' })
              instance.reset()
            }
          }, 3000)
          timers.add(timer)
        })
        ready.value = true
        diagnose?.('widget.ready', { widgetGeneration: current })
      })
    } catch (e) {
      if (current !== generation) return
      error.value = e instanceof Error ? e.message : '验证码加载失败'
      diagnose?.('widget.error', { widgetGeneration: current, reason: 'load-or-init-failed' })
    }
  }

  function destroy() {
    diagnose?.('widget.destroy', { widgetGeneration: generation, ready: Boolean(gt) })
    generation++
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
    try {
      gt?.destroy?.()
    } catch {
      diagnose?.('widget.error', { widgetGeneration: generation, reason: 'destroy-failed' })
    }
    gt = null
    ready.value = false
    if (container.value) container.value.innerHTML = ''
  }

  onUnmounted(destroy)

  return { ready, error, mount, destroy }
}
