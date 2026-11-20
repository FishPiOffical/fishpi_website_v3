import { ApiError, request } from './http'

export type ChatPublicationCommand = {
  content: string
  client: string
  key: string
  origin?: 'repeat'
  replyToMessageId?: string
}

export type ChatPublicationReceipt = { id: string; createdAt: number }

export function chatPublicationContent(value: string, replyToMessageId?: string) {
  if (replyToMessageId !== undefined && (typeof replyToMessageId !== 'string' || !/^\d{1,32}$/.test(replyToMessageId))) {
    throw new ApiError('引用消息编号不合法', 422)
  }
  if (typeof value !== 'string') throw new ApiError('消息正文不合法', 422)

  const content = value.trim()
  const malformedUnicode = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u
  if ((!content && !replyToMessageId) || content.length > 4096 || malformedUnicode.test(content)) {
    throw new ApiError('消息正文须为1至4096个字符', 422)
  }
  return content
}

export async function publishChat(command: ChatPublicationCommand): Promise<ChatPublicationReceipt> {
  const { client, key, replyToMessageId } = command
  const content = chatPublicationContent(command.content, replyToMessageId)
  if (client !== 'Web/PC网页端' || typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) {
    throw new ApiError('发送参数不合法', 422)
  }

  const response = await request<{ code: number; data?: { id?: unknown; createdAt?: unknown } }>('/api/v3/chat/messages', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ content, client, replyToMessageId }),
  })
  const data = response?.data
  if (response?.code !== 0 || typeof data?.id !== 'string' || !/^\d{1,32}$/.test(data.id)
    || typeof data.createdAt !== 'number' || !Number.isSafeInteger(data.createdAt) || data.createdAt < 0) {
    throw new ApiError('发送回执不正确', 502)
  }
  return { id: data.id, createdAt: data.createdAt }
}
