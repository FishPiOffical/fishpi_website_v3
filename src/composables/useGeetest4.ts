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

function loadScript(): Promise<InitFn> {
  const w = window as Window & { initGeetest4?: InitFn }
  if (w.initGeetest4) return Promise.resolve(w.initGeetest4)
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-fp-geetest4]')
    if (existing) {
      existing.addEventListener('load', () => {
        const init = (window as Window & { initGeetest4?: InitFn }).initGeetest4
        if (init) resolve(init)
        else reject(new Error('GeeTest 不可用'))
      })
      existing.addEventListener('error', () => reject(new Error('GeeTest 脚本加载失败')))
      return
    }
    const s = document.createElement('script')
    s.src = 'https://static.geetest.com/v4/gt4.js'
    s.async = true
    s.dataset.fpGeetest4 = '1'
    s.onload = () => {
      const init = (window as Window & { initGeetest4?: InitFn }).initGeetest4
      if (init) resolve(init)
      else reject(new Error('GeeTest 不可用'))
    }
    s.onerror = () => reject(new Error('GeeTest 脚本加载失败'))
    document.head.appendChild(s)
  })
}

export function useGeetest4(container: Ref<HTMLElement | null>, onSuccess: (validate: unknown) => void) {
  const ready = ref(false)
  const error = ref('')
  let gt: Geetest4Instance | null = null

  async function mount(product: 'float' | 'popup' = 'float') {
    error.value = ''
    if (!container.value) {
      error.value = '验证码容器未就绪'
      return
    }
    try {
      const init = await loadScript()
      container.value.innerHTML = ''
      ready.value = false
      init({ captchaId: FISHPI_GEETEST_ID, product }, (instance) => {
        gt = instance
        instance.appendTo(container.value!).onSuccess(() => {
          onSuccess(instance.getValidate())
          setTimeout(() => instance.reset(), 3000)
        })
        ready.value = true
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : '验证码加载失败'
    }
  }

  function destroy() {
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
