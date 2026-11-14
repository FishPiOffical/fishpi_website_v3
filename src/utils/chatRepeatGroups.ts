import type { ChatLine } from '@/stores/chat'

export interface RepeatEntry { key: string; message: ChatLine | null }
// 仅合并连续的纯文字消息；不丢弃空白、链接或格式差异，也不为分组补查正文。
export function repeatKey(line: ChatLine | null): string | null {
  if (!line || line.redPacket || line.card || !line.content?.trim()) return null
  if (!line.html || /<(?!\/?p(?:\s|>)|br\s*\/?\s*>)[a-z]/i.test(line.html)) return null
  if (/^\s*>/m.test(line.content)) return null
  return line.content
}
export function groupChatRepeats<T extends RepeatEntry>(entries: T[]): T[][] {
  const groups: T[][] = []
  let previous: string | null = null
  for (const entry of entries) {
    const key = repeatKey(entry.message)
    if (key !== null && key === previous) groups[groups.length - 1]!.push(entry)
    else groups.push([entry])
    previous = key
  }
  return groups
}
