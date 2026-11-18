import { getAccessToken, getAuthContextVersion } from '@/api/http'
import { uploadV3Files, uploadedMarkdown } from '@/api/v3-uploads'

export type EditorUploadStatus = { pending: boolean; text: string } | null

function formatUploadLimit(bytes: number) {
  if (bytes % (1024 * 1024) === 0) return `${bytes / (1024 * 1024)} MB`
  if (bytes % 1024 === 0) return `${bytes / 1024} KB`
  return `${bytes} 字节`
}

export function createEditorUpload(
  insert: (markdown: string) => void,
  showStatus: (status: EditorUploadStatus) => void = () => {},
) {
  let controller: AbortController | null = null, generation = 0, disposed = false
  function cancel() {
    generation++
    controller?.abort()
    controller = null
    showStatus(null)
  }
  return {
    cancel,
    dispose() { disposed = true; cancel() },
    async handler(files: File[]): Promise<string | null> {
      if (disposed) return '编辑器已关闭'
      if (!files.length) return null
      if (controller) return '文件正在上传，请等待当前上传完成'
      if (!getAccessToken()) {
        const text = '请先登录后再上传'
        showStatus({ pending: false, text })
        return text
      }
      const abort = new AbortController(), version = getAuthContextVersion(), run = generation
      controller = abort
      const current = () => !disposed && !abort.signal.aborted && run === generation && version === getAuthContextVersion() && !!getAccessToken()
      const label = files.every(file => file.type.startsWith('image/')) ? '张图片' : '个文件'
      showStatus({ pending: true, text: `正在上传 ${files.length} ${label}…` })
      let message: string | null = null
      try {
        const results = await uploadV3Files(files, abort.signal)
        if (!current()) return null
        const markdown = results.map(uploadedMarkdown).filter(Boolean).join('\n')
        if (markdown) insert(`\n${markdown}\n`)
        const failures = results.filter(item => !item.url)
        if (failures.length) {
          const details: string[] = []
          const succeeded = results.length - failures.length
          if (succeeded) details.push(`已插入 ${succeeded} 个文件`)
          const tooLarge = failures.filter(item => item.maxBytes !== undefined)
          const otherFailures = failures.length - tooLarge.length
          for (const item of tooLarge) {
            if (item.maxBytes !== undefined) details.push(`「${item.name}」超过单文件上限，最大可上传 ${formatUploadLimit(item.maxBytes)}`)
          }
          if (otherFailures) details.push(`${otherFailures}个文件上传失败或未返回结果，请检查后重试失败文件`)
          message = details.join('。')
        }
        return message
      } catch (error) {
        if (!current()) return null
        message = error instanceof Error ? error.message : '文件上传失败'
        return message
      } finally {
        if (controller === abort) {
          const isCurrent = current()
          controller = null
          showStatus(isCurrent && message ? { pending: false, text: message } : null)
        }
      }
    },
  }
}
