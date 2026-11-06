import { getAccessToken, getAuthContextVersion } from '@/api/http'
import { uploadV3Files, uploadedMarkdown } from '@/api/v3-uploads'

export function createEditorUpload(insert: (markdown: string) => void) {
  let controller: AbortController | null = null, generation = 0, disposed = false
  function cancel() { generation++; controller?.abort(); controller = null }
  return {
    cancel,
    dispose() { disposed = true; cancel() },
    async handler(files: File[]): Promise<string | null> {
      if (disposed) return '编辑器已关闭'
      if (!getAccessToken()) return '请先登录后再上传'
      if (controller) return '文件正在上传，请等待当前上传完成'
      const abort = new AbortController(), version = getAuthContextVersion(), run = generation
      controller = abort
      const current = () => !disposed && !abort.signal.aborted && run === generation && version === getAuthContextVersion() && !!getAccessToken()
      try {
        const results = await uploadV3Files(files, abort.signal)
        if (!current()) return null
        const markdown = results.map(uploadedMarkdown).filter(Boolean).join('\n')
        if (markdown) insert(`\n${markdown}\n`)
        const failures = results.filter(item => !item.url)
        return failures.length ? `已插入${results.length - failures.length}个文件，${failures.length}个文件上传失败或未返回结果，请检查后重试失败文件` : null
      } catch (error) {
        if (!current()) return null
        return error instanceof Error ? error.message : '文件上传失败'
      } finally { if (controller === abort) controller = null }
    },
  }
}
