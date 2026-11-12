import { ApiError, request } from './http'

export interface ChatTailSettings { enabled: boolean; text: string }
export interface ChatTailCommand extends ChatTailSettings { key: string }
export const CHAT_TAIL_MAX_LENGTH = 24
export const CHAT_TAIL_MAX_UNITS = 512
const endpoint = '/api/v3/me/settings/chat-tail'

/** 字素计数只用于输入提示；Unicode 版本差异仍以服务端校验为准。 */
export function chatTailLength(text: string): number | null {
  if (typeof Intl.Segmenter !== 'function') return null
  return Array.from(new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(text)).length
}

export function validateChatTail(value: ChatTailSettings) {
  if (typeof value.enabled !== 'boolean' || typeof value.text !== 'string' || value.text.length > CHAT_TAIL_MAX_UNITS
      || /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(value.text)
      || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value.text)) {
    throw new ApiError('小尾巴须为单行文字或 Emoji', 422)
  }
  if (value.enabled && !value.text.trim()) throw new ApiError('请填写小尾巴内容', 422)
}

function decode(value: unknown): ChatTailSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('小尾巴设置读取失败', 502)
  const row = value as ChatTailSettings
  try { validateChatTail(row) } catch { throw new ApiError('小尾巴设置读取失败', 502) }
  return { enabled: row.enabled, text: row.text }
}

export async function readChatTail(signal?: AbortSignal): Promise<ChatTailSettings> {
  const result = await request<{ code: number; data: unknown }>(endpoint, { signal, cache: 'no-store' })
  if (result?.code !== 0) throw new ApiError('小尾巴设置读取失败', 502)
  return decode(result.data)
}

export async function saveChatTail(command: ChatTailCommand): Promise<void> {
  validateChatTail(command)
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(command.key)) throw new ApiError('操作标识不合法', 422)
  const result = await request<{ code: number }>(endpoint, {
    method: 'PUT', headers: { 'Idempotency-Key': command.key },
    body: JSON.stringify({ enabled: command.enabled, text: command.text }),
  })
  if (result?.code !== 0) throw new ApiError('小尾巴设置保存失败', 502)
}
