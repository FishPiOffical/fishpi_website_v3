import { ApiError, getAccessToken, getAuthContextVersion } from '@/api/http'
import { uploadV3Files, uploadedMarkdown, type UploadResult } from '@/api/v3-uploads'

export type EditorUploadStatus = { pending: boolean; text: string } | null

const imageFormats = new Map([
  ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['png', 'image/png'],
  ['gif', 'image/gif'], ['webp', 'image/webp'],
])
const attachmentFormats = ['zip', 'rar', '7z', 'mp3', 'mp4', 'webm', 'mov']
export const editorUploadAccept = [...imageFormats.keys(), ...attachmentFormats].map(ext => `.${ext}`).join(',')
const supportedImageTypes = new Set(imageFormats.values())

async function validateEditorFile(file: File, signal: AbortSignal): Promise<File> {
  const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase()
  const expected = extension ? imageFormats.get(extension) : undefined
  if (!expected && !file.type.toLowerCase().startsWith('image/')) {
    if (extension && attachmentFormats.includes(extension)) return file
    throw new Error(`「${file.name}」格式不支持。图片仅支持 JPG、PNG、GIF、WebP，其他附件支持 ${attachmentFormats.map(ext => ext.toUpperCase()).join('、')}`)
  }
  const unsupported = () => new Error(`「${file.name || '粘贴的图片'}」格式不支持，图片仅支持 JPG、PNG、GIF、WebP`)
  if (extension ? !expected : !supportedImageTypes.has(file.type)) throw unsupported()
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  signal.throwIfAborted()
  const ascii = (start: number, end: number) => String.fromCharCode(...header.slice(start, end))
  let actual: string
  if (header[0] === 255 && header[1] === 216 && header[2] === 255) actual = 'image/jpeg'
  else if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => header[index] === value)) actual = 'image/png'
  else if (['GIF87a', 'GIF89a'].includes(ascii(0, 6))) actual = 'image/gif'
  else if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') actual = 'image/webp'
  else throw unsupported()
  if (actual !== (expected || file.type)) throw unsupported()
  return file.type === actual ? file : new File([file], file.name, { type: actual, lastModified: file.lastModified })
}

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
        const validated: File[] = []
        const rejected: string[] = []
        for (const file of files) {
          try {
            validated.push(await validateEditorFile(file, abort.signal))
          } catch (error) {
            if (!current()) return null
            rejected.push(error instanceof Error ? error.message : '无法读取所选文件')
          }
          if (!current()) return null
        }
        if (!validated.length) {
          message = rejected.join('。')
          return message
        }
        const results: UploadResult[] = []
        for (const [index, file] of validated.entries()) {
          if (validated.length > 1) {
            showStatus({ pending: true, text: `正在上传 ${index + 1}/${validated.length}：${file.name}` })
          }
          try {
            const [result] = await uploadV3Files([file], abort.signal)
            if (!current()) return null
            if (result) results.push(result)
          } catch (error) {
            if (!current()) return null
            const reason = error instanceof Error ? error.message : '文件上传失败'
            rejected.push(validated.length === 1 ? reason : `「${file.name}」：${reason}`)
            if (error instanceof ApiError && [401, 403, 429].includes(error.status)) {
              const remaining = validated.length - index - 1
              if (remaining) rejected.push(`剩余 ${remaining} 个文件尚未上传`)
              break
            }
          }
        }
        const markdown = results.map(uploadedMarkdown).filter(Boolean).join('\n')
        if (markdown) insert(`\n${markdown}\n`)
        const failures = results.filter(item => !item.url)
        if (failures.length || rejected.length) {
          const details: string[] = []
          const succeeded = results.length - failures.length
          if (succeeded) details.push(`已插入 ${succeeded} 个文件`)
          const tooLarge = failures.filter(item => item.maxBytes !== undefined)
          const otherFailures = failures.length - tooLarge.length
          for (const item of tooLarge) {
            if (item.maxBytes !== undefined) details.push(`「${item.name}」超过单文件上限，最大可上传 ${formatUploadLimit(item.maxBytes)}`)
          }
          if (otherFailures) details.push(`${otherFailures}个文件上传失败或未返回结果，请检查后重试失败文件`)
          const formatMessage = failures.find(item => item.failureMessage)?.failureMessage
          if (formatMessage) details.push(formatMessage)
          message = [...details, ...rejected].join('。')
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
