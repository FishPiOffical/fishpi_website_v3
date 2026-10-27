import { ApiError, request } from './http'
export type PointTransfer = { userName: string; amount: number; memo: string }
export type TransferReceipt = { transferId: string; recipient: { userId: string; userName: string }; amount: number; receivedPoints: number; feePoints: number; memo: string }
export type InvitationReceipt = { code: string; expiresAt: number; paidPoints: number }
export type InvitationStatus = 'unused' | 'used' | 'stopped'
type Row = Record<string, unknown>
const invalid = () => new ApiError('积分操作响应格式不正确', 502, 'invalid_response')
const object = (value: unknown): Row => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Row }
const number = (value: unknown): number => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid(); return value }
function text(value: unknown, max: number): string { if (typeof value !== 'string' || value.length > max) throw invalid(); return value }
function id(value: unknown): string { const result = text(value, 19); if (!/^[1-9][0-9]{0,18}$/.test(result)) throw invalid(); return result }
function header(key?: string) { if (key !== undefined && !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new ApiError('操作标识不合法', 422); return { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) } }
async function post(path: string, body: Row, key?: string): Promise<Row> { const response = await request<{ code: number; msg?: string; data?: unknown }>(path, { method: 'POST', headers: header(key), body: JSON.stringify(body) }); if (response.code !== 0) throw new ApiError(response.msg || '积分操作失败', 400); return object(response.data) }
export function pointTransferInput(input: PointTransfer): PointTransfer {
  const userName = typeof input.userName === 'string' ? input.userName.trim() : '', amount = input.amount
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userName) || !Number.isInteger(amount) || amount < 2 || amount > 2147483647 || typeof input.memo !== 'string') throw new ApiError('收款用户名或积分数量不合法，数量须为至少2的整数', 422)
  const memo = input.memo.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '')
  if (memo.length > 128 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(memo) || Array.from(memo).some(char => char.length === 1 && /[\ud800-\udfff]/.test(char))) throw new ApiError('备注最多128个字符，不能含无效字符', 422)
  return { userName, amount, memo }
}
export async function transferV3Points(input: PointTransfer, key: string): Promise<TransferReceipt> {
  const body = pointTransferInput(input), row = await post('/api/v3/me/point-transfers', body, key), recipient = object(row.recipient)
  const amount = number(row.amount), receivedPoints = number(row.receivedPoints), feePoints = number(row.feePoints), userName = text(recipient.userName, 64)
  if (amount !== body.amount || receivedPoints < 1 || receivedPoints + feePoints !== amount || !/^[A-Za-z0-9_-]{1,64}$/.test(userName)) throw invalid()
  return { transferId: id(row.transferId), recipient: { userId: id(recipient.userId), userName }, amount, receivedPoints, feePoints, memo: text(row.memo, 255) }
}
export async function purchaseV3Invitation(key: string): Promise<InvitationReceipt> {
  const row = await post('/api/v3/me/invitation-codes', {}, key), code = text(row.code, 16), expiresAt = number(row.expiresAt), paidPoints = number(row.paidPoints)
  if (!/^[A-Za-z0-9]{16}$/.test(code) || expiresAt < 1) throw invalid()
  return { code, expiresAt, paidPoints }
}
export function invitationInput(value: string): string { const code = typeof value === 'string' ? value.trim() : ''; if (!/^[A-Za-z0-9]{16}$/.test(code)) throw new ApiError('邀请码须为16位英文字母或数字', 422); return code }
export async function fetchV3InvitationStatus(value: string): Promise<InvitationStatus> {
  const row = await post('/api/v3/invitation-codes/status', { code: invitationInput(value) })
  if (row.status !== 'unused' && row.status !== 'used' && row.status !== 'stopped') throw invalid()
  return row.status
}
