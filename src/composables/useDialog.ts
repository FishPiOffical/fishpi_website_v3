import { ref } from 'vue'

export interface ConfirmDialogOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  tone?: 'default' | 'danger'
  signal?: AbortSignal
}

export interface PromptDialogOptions {
  title?: string
  message: string
  defaultValue?: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
}

interface ActiveDialogState {
  kind: 'confirm' | 'prompt'
  title: string
  message: string
  confirmText: string
  cancelText: string
  tone: 'default' | 'danger'
  inputValue: string
  placeholder: string
  resolve: (val: any) => void
}

export const activeDialogState = ref<ActiveDialogState | null>(null)

export function fpConfirm(options: string | ConfirmDialogOptions): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  const opts: ConfirmDialogOptions =
    typeof options === 'string' ? { message: options } : options
  if (opts.signal?.aborted) return Promise.resolve(false)
  if (activeDialogState.value) {
    activeDialogState.value.resolve(activeDialogState.value.kind === 'confirm' ? false : null)
  }
  return new Promise<boolean>((resolve) => {
    const abort = () => finish(false)
    const finish = (value: boolean) => {
      opts.signal?.removeEventListener('abort', abort)
      if (activeDialogState.value?.resolve === finish) activeDialogState.value = null
      resolve(value)
    }
    opts.signal?.addEventListener('abort', abort, { once: true })
    activeDialogState.value = {
      kind: 'confirm',
      title: opts.title || '操作确认',
      message: opts.message,
      confirmText: opts.confirmText || '确定',
      cancelText: opts.cancelText || '取消',
      tone: opts.tone || 'default',
      inputValue: '',
      placeholder: '',
      resolve: finish,
    }
  })
}

export function fpPrompt(options: string | PromptDialogOptions, defaultValue = ''): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  const opts: PromptDialogOptions =
    typeof options === 'string' ? { message: options, defaultValue } : options
  if (activeDialogState.value) {
    activeDialogState.value.resolve(activeDialogState.value.kind === 'confirm' ? false : null)
  }
  return new Promise<string | null>((resolve) => {
    activeDialogState.value = {
      kind: 'prompt',
      title: opts.title || '请输入',
      message: opts.message,
      confirmText: opts.confirmText || '确定',
      cancelText: opts.cancelText || '取消',
      tone: 'default',
      inputValue: opts.defaultValue ?? '',
      placeholder: opts.placeholder || '',
      resolve,
    }
  })
}
