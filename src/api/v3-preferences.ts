import { ApiError, request } from './http'

export type PreferenceResource = 'functions' | 'display' | 'privacy' | 'location' | 'locale'
export type PreferenceValue = string | number | boolean
export interface PreferenceField { key: string; label: string; kind: 'boolean' | 'string' | 'number' | 'choice'; max?: number; min?: number; choices?: { value: number; label: string }[] }
const bool = (key: string, label: string): PreferenceField => ({ key, label, kind: 'boolean' })
const choices = (key: string, label: string, labels: string[]): PreferenceField => ({ key, label, kind: 'choice', choices: labels.map((label, value) => ({ value, label })) })
export const preferenceFields: Record<PreferenceResource, PreferenceField[]> = {
  functions: [
    { key: 'listPageSize', label: '每页帖子数', kind: 'number', min: 10, max: 96 },
    choices('listViewMode', '列表模式', ['仅标题', '标题与摘要']),
    { key: 'indexRedirectURL', label: '首页跳转地址', kind: 'string', max: 255 },
    bool('notifications', '启用通知'), bool('subscriptionEmail', '邮件订阅'), bool('keyboardShortcuts', '键盘快捷键'),
    bool('autoSubscribeOnReply', '回复时关注帖子'), bool('externalLinkConfirmation', '外部链接跳转确认'), bool('chatImageBlur', '模糊处理聊天室图片'),
  ],
  display: [choices('commentViewMode', '评论展示', ['传统', '实时']), choices('avatarViewMode', '头像显示', ['原图', '静态图']),
    { key: 'skin', label: '桌面皮肤', kind: 'string', max: 32 }, { key: 'mobileSkin', label: '移动皮肤', kind: 'string', max: 32 }],
  privacy: [bool('articles', '公开帖子列表'), bool('comments', '公开回帖列表'), bool('breezemoons', '公开清风明月列表'),
    bool('points', '公开积分列表'), bool('followers', '公开关注者列表'), bool('followingUsers', '公开关注用户列表'),
    bool('followingTags', '公开关注标签列表'), bool('followingArticles', '公开收藏帖子列表'), bool('watchingArticles', '公开关注帖子列表'),
    bool('online', '公开在线状态'), bool('userAgent', '公开 UA 信息'), bool('joinPointRank', '参与财富排行'), bool('joinUsedPointRank', '参与消费排行')],
  location: [bool('publicLocation', '公开地理位置')],
  locale: [{ key: 'language', label: '语言', kind: 'string', max: 64 }, { key: 'timezone', label: '时区', kind: 'string', max: 64 }],
}
type Row = Record<string, unknown>
const invalid = () => new ApiError('偏好设置响应格式不正确', 502, 'invalid_response')
function row(value: unknown): Row { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Row }
function text(value: unknown): string { if (typeof value !== 'string') throw invalid(); return value }
async function data(path: string, init?: RequestInit): Promise<Row> {
  const envelope = row(await request(path, init)); if (envelope.code !== 0) throw invalid(); return row(envelope.data)
}
function fields(resource: PreferenceResource): PreferenceField[] {
  if (!Object.hasOwn(preferenceFields, resource)) throw new ApiError('设置类别不合法', 422)
  return preferenceFields[resource]
}
function project(resource: PreferenceResource, source: Row): Record<string, PreferenceValue> {
  return Object.fromEntries(fields(resource).map(field => {
    const value = source[field.key]
    if (field.kind === 'boolean' ? typeof value !== 'boolean' : field.kind === 'string' ? typeof value !== 'string' : typeof value !== 'number' || !Number.isSafeInteger(value)) throw invalid()
    return [field.key, value as PreferenceValue]
  }))
}
export async function fetchV3Preferences(resource: PreferenceResource): Promise<Record<string, PreferenceValue>> {
  fields(resource); return project(resource, await data(`/api/v3/me/settings/${resource}`))
}
export async function saveV3Preferences(resource: PreferenceResource, changes: Record<string, PreferenceValue>, key: string): Promise<Record<string, PreferenceValue>> {
  const schema = fields(resource), entries = Object.entries(changes)
  if (!entries.length || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new ApiError('设置参数不合法', 422)
  for (const [name, value] of entries) {
    const field = schema.find(field => field.key === name)
    if (!field || (field.kind === 'boolean' ? typeof value !== 'boolean' : field.kind === 'string' ? typeof value !== 'string' || value.length > field.max! : typeof value !== 'number' || !Number.isInteger(value))) throw new ApiError('设置参数不合法', 422)
    if (field.kind === 'number' && ((value as number) < field.min! || (value as number) > field.max!) || field.kind === 'choice' && !field.choices?.some(choice => choice.value === value)) throw new ApiError('设置选项不合法', 422)
  }
  return project(resource, await data(`/api/v3/me/settings/${resource}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(changes) }))
}
export interface PreferenceOption { value: string; label: string }
export async function fetchV3LocaleOptions(): Promise<{ language: PreferenceOption[]; timezone: PreferenceOption[] }> {
  const source = await data('/api/v3/me/settings/locale-options')
  if (!Array.isArray(source.languages) || !Array.isArray(source.timezones)) throw invalid()
  const language = source.languages.map(value => { const id = text(value); return { value: id, label: ({ zh_CN: '简体中文', en_US: 'English' } as Record<string, string>)[id] || id } })
  const timezone = source.timezones.map(value => { const zone = row(value); return { value: text(zone.id), label: text(zone.name) } })
  return { language, timezone }
}
export async function fetchV3SkinOptions(): Promise<{ skin: PreferenceOption[]; mobileSkin: PreferenceOption[] }> {
  const source = await data('/api/v3/me/settings/skins')
  if (!Array.isArray(source.list)) throw invalid()
  const skin: PreferenceOption[] = [], mobileSkin: PreferenceOption[] = []
  for (const value of source.list) {
    const entry = row(value), option = { value: text(entry.id), label: text(entry.name) }, device = text(entry.device)
    if (device === 'pc') skin.push(option); else if (device === 'mobile') mobileSkin.push(option); else throw invalid()
  }
  return { skin, mobileSkin }
}
