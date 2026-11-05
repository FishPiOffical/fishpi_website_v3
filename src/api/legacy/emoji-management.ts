import { ApiError, request } from '../http'
import { getLegacyKey } from './auth'
import { legacyObject } from './home'
import { legacyEditorImage } from './editor'
export type EmojiCommand =
  | { op: 'create'; name: string; sort: number }
  | { op: 'update-group'; groupId: string; name: string; sort: number }
  | { op: 'delete-group'; groupId: string }
  | { op: 'add-url'; groupId: string; url: string; name: string; sort: number }
  | { op: 'update-item'; groupId: string; itemId: string; name: string; sort: number }
  | { op: 'remove-item'; groupId: string; emojiId: string }
  | { op: 'share'; groupId: string }
  | { op: 'import'; shareCode: string }
  | { op: 'migrate' }
export type EmojiReceipt =
  | { op: 'share'; groupId: string; shareCode: string; groupName: string; emojiCount: number; createdTime: number }
  | { op: 'import'; groupId: string; groupName: string; sourceGroupName: string; emojiCount: number }
  | { op: Exclude<EmojiCommand['op'], 'share' | 'import'> }
function id(v: string) { if (typeof v !== 'string' || !/^[1-9][0-9]{0,31}$/.test(v)) throw new ApiError('表情编号不合法', 422); return v }
function name(v: string, required: boolean) {
  if (typeof v !== 'string' || v.length > 20 || required && !v.trim() || /[\u0000-\u001f\u007f]/.test(v) || !!v && !/^[\p{L}\p{N}\s_\-。，！？!?:：；;（）()\[\]{}·]+$/u.test(v)) throw new ApiError('名称应为最多20字的文字、数字或常用标点', 422)
  return v
}
function sort(v: number) { if (!Number.isInteger(v) || v < -2147483648 || v > 2147483647) throw new ApiError('排序须为32位整数', 422); return v }
/** Whitelist both command and body: member IDs and global emoji IDs have different meanings. */
export function emojiCommand(input: EmojiCommand): EmojiCommand {
  switch (input.op) {
    case 'create': return { op: input.op, name: name(input.name, true), sort: sort(input.sort) }
    case 'update-group': return { op: input.op, groupId: id(input.groupId), name: name(input.name, true), sort: sort(input.sort) }
    case 'delete-group': return { op: input.op, groupId: id(input.groupId) }
    case 'add-url': {
      const url = legacyEditorImage(input.url)
      if (!url || !/^https?:\/\//.test(url) || url !== input.url || url.length > 2048) throw new ApiError('请输入有效的 HTTP(S) 图片地址', 422)
      return { op: input.op, groupId: id(input.groupId), url, name: name(input.name, false), sort: sort(input.sort) }
    }
    case 'update-item': return { op: input.op, groupId: id(input.groupId), itemId: id(input.itemId), name: name(input.name, false), sort: sort(input.sort) }
    case 'remove-item': return { op: input.op, groupId: id(input.groupId), emojiId: id(input.emojiId) }
    case 'share': return { op: input.op, groupId: id(input.groupId) }
    case 'import': {
      const code = typeof input.shareCode === 'string' ? input.shareCode.trim().toUpperCase() : ''
      if (!/^[A-Z0-9]{8,16}$/.test(code)) throw new ApiError('分享码应为8至16位字母或数字', 422)
      return { op: input.op, shareCode: code }
    }
    case 'migrate': return { op: input.op }
    default: throw new ApiError('表情操作不合法', 422)
  }
}
export async function writeLegacyEmoji(input: EmojiCommand): Promise<EmojiReceipt> {
  const command = emojiCommand(input), key = getLegacyKey()
  if (!key) throw new ApiError('请先登录', 401)
  const { op, ...fields } = command
  const paths = { create: 'group/create', 'update-group': 'group/update', 'delete-group': 'group/delete', 'add-url': 'group/add-url-emoji', 'update-item': 'emoji/update', 'remove-item': 'group/remove-emoji', share: 'group/share/create', import: 'group/share/import', migrate: 'emoji/migrate' }
  const body: Record<string, unknown> = { ...fields, apiKey: key }
  if (command.op === 'update-item') { delete body.itemId; body.oId = command.itemId }
  const result = legacyObject(await request('/api/emoji/' + paths[op], { method: 'POST', body: JSON.stringify(body), cache: 'no-store', redirect: 'error', __captchaRetried: true }))
  if (key !== getLegacyKey()) throw new ApiError('登录状态已变化', 409)
  if (result.code !== 0) throw new ApiError(typeof result.msg === 'string' ? result.msg : '表情操作结果未确认', 502)
  if (command.op === 'share' || command.op === 'import') {
    const data = legacyObject(result.data), bad = () => new ApiError('表情操作已返回，但结果格式未确认，请核对后再操作', 502)
    const text = (v: unknown) => { if (typeof v !== 'string' || v.length > 1024) throw bad(); return v }
    const count = (v: unknown) => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw bad(); return v }
    const groupName = text(data.groupName), emojiCount = count(data.emojiCount)
    if (command.op === 'share') {
      if (typeof data.shareCode !== 'string' || !/^[A-Z0-9]{12}$/.test(data.shareCode)) throw bad()
      return { op: 'share', groupId: command.groupId, groupName, emojiCount, shareCode: data.shareCode, createdTime: count(data.createdTime) }
    }
    if (data.shareCode !== command.shareCode || typeof data.groupId !== 'string' || !/^[1-9][0-9]{0,31}$/.test(data.groupId)) throw bad()
    return { op: 'import', groupId: data.groupId, groupName, emojiCount, sourceGroupName: text(data.sourceGroupName) }
  }
  // Success metadata is never a current group/member snapshot or an idempotency receipt.
  return { op: command.op }
}
