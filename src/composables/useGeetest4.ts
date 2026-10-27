import { onUnmounted, ref, type Ref } from 'vue'

/** FishPi / Rhythm 现网 GeeTest4 captchaId（与 forget-pwd / settings 一致）。 */
export const FISHPI_GEETEST_ID = '6d886bcaec3f86fcfd6f61bff5af2cb4'

export type Geetest4Instance = {
  appendTo: (el: string | HTMLElement) => Geetest4Instance
  onSuccess: (cb: () => void) => Geetest4Instance
  getValidate: () => unknown
  reset: () => void
  destroy?: () => void
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

export function useGeetest4(container: Ref<HTMLElement | null>, onSuccess: (validate: unknown) => void) {
  const ready = ref(false)
  const error = ref('')
  let gt: Geetest4Instance | null = null
  let generation = 0
  const timers = new Set<ReturnType<typeof setTimeout>>()

  async function mount(product: 'float' | 'popup' = 'float') {
    destroy()
    const current = ++generation, target = container.value
    error.value = ''
    if (!target) {
      error.value = '验证码容器未就绪'
      return
    }
    try {
      const init = await loadScript()
      if (current !== generation || container.value !== target) return
      target.innerHTML = ''
      ready.value = false
      init({ captchaId: FISHPI_GEETEST_ID, product }, (instance) => {
        if (current !== generation || container.value !== target) { instance.destroy?.(); return }
        gt = instance
        instance.appendTo(target).onSuccess(() => {
          if (current !== generation || container.value !== target || gt !== instance) return
          onSuccess(instance.getValidate())
          const timer = setTimeout(() => { timers.delete(timer); if (current === generation && gt === instance) instance.reset() }, 3000)
          timers.add(timer)
        })
        ready.value = true
      })
    } catch (e) {
      if (current !== generation) return
      error.value = e instanceof Error ? e.message : '验证码加载失败'
    }
  }

  function destroy() {
    generation++
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
    try {
      gt?.destroy?.()
    } catch {
      /* ignore */
    }
    gt = null
    ready.value = false
    if (container.value) container.value.innerHTML = ''
  }

  onUnmounted(destroy)

  return { ready, error, mount, destroy }
}
