import { md5 } from 'js-md5'
import { request, withKey } from './http'

export interface AccountInfo {
  oId: string
  userName: string
  userNickname?: string
  userAvatarURL?: string
  userPoint?: number
}

export interface ArticleSummary {
  oId: string
  articleTitle: string
  articleTitleEmoj?: string
  articleViewCount?: number
  articleViewCntDisplayFormat?: string
  articleStick?: number
  articleType?: number
  columnTitle?: string
  articleAuthorName?: string
  articleAuthorThumbnailURL48?: string
}

export interface RankUser {
  oId?: string
  userName: string
  userAvatarURL?: string
  userCheckinStreak?: number
  onlineMinute?: number
}

interface Envelope<T> {
  code: number
  msg?: string
  Key?: string
  data?: T
}

export async function login(username: string, passwd: string, mfaCode = '') {
  const res = await request<Envelope<never>>('/api/getKey', {
    method: 'POST',
    body: JSON.stringify({
      nameOrEmail: username,
      userPassword: md5(passwd),
      mfaCode,
    }),
  })
  if (res.code !== 0 || !res.Key) throw new Error(res.msg || '登录失败')
  return res.Key
}

export async function fetchAccount(apiKey: string) {
  const res = await request<Envelope<AccountInfo>>(withKey('/api/user', apiKey))
  if (res.code !== 0 || !res.data) throw new Error(res.msg || '密钥无效')
  return res.data
}

/** Rhythm 把 `/api/articles/recent*` 挂了 loginCheck，未登录请用 fetchPublicHome。 */
export async function fetchRecentArticles(apiKey?: string | null, page = 1, size = 40) {
  const res = await request<Envelope<{ articles?: ArticleSummary[] } | ArticleSummary[]>>(
    withKey(`/api/articles/recent?p=${page}&size=${size}`, apiKey),
  )
  if (res.code !== 0) throw new Error(res.msg || '文章列表失败')
  const data = res.data
  if (Array.isArray(data)) return data
  return data?.articles ?? []
}

export async function fetchCheckinRank(apiKey?: string | null): Promise<RankUser[]> {
  const res = await request<Envelope<RankUser[] | { users?: RankUser[] }>>(
    withKey('/api/top/checkin?p=1', apiKey),
  )
  if (Array.isArray(res.data)) return res.data
  if (res.data && 'users' in res.data && Array.isArray(res.data.users)) return res.data.users
  return []
}

export async function fetchOnlineRank(apiKey?: string | null): Promise<RankUser[]> {
  const res = await request<Envelope<RankUser[] | { users?: RankUser[] }>>(
    withKey('/api/top/online?p=1', apiKey),
  )
  if (Array.isArray(res.data)) return res.data
  if (res.data && 'users' in res.data && Array.isArray(res.data.users)) return res.data.users
  return []
}

export async function fetchMembership(userId: string) {
  const res = await request<Envelope<{ expiresAt?: number; status?: string; isActive?: boolean }>>(
    `/api/membership/${userId}`,
  )
  if (res.code !== 0) return { isVip: false }
  const data = res.data
  const expiresAt = Number(data?.expiresAt || 0)
  const isVip = Boolean(data?.isActive) || (expiresAt > Date.now())
  return { isVip, expiresAt }
}

export async function fetchChatHistory(apiKey: string, page = 1) {
  const res = await request<Envelope<ChatHistoryItem[]>>(
    withKey(`/chat-room/more?page=${page}&type=html`, apiKey),
  )
  if (res.code !== 0) throw new Error(res.msg || '聊天记录失败')
  return res.data ?? []
}

export async function sendChat(apiKey: string, content: string) {
  const res = await request<Envelope<unknown>>('/chat-room/send', {
    method: 'POST',
    body: JSON.stringify({
      content,
      client: 'Web/v3',
      apiKey,
    }),
  })
  if (res.code) throw new Error(res.msg || '发送失败')
}

export async function openRedPacket(apiKey: string, oId: string, gesture?: number) {
  const res = await request<Envelope<Record<string, unknown>>>('/chat-room/red-packet/open', {
    method: 'POST',
    body: JSON.stringify({ oId, gesture, apiKey }),
  })
  if (res.code) throw new Error(res.msg || '领取失败')
  return res
}

export async function fetchMutes() {
  const res = await request<Envelope<MuteItem[]>>('/chat-room/si-guo-list')
  if (res.code) return []
  return res.data ?? []
}

export async function fetchChatNode(apiKey: string) {
  const res = await request<{ code: number; msg?: string; data?: string }>('/chat-room/node/get?apiKey=' + apiKey)
  if (res.code !== 0 || !res.data) throw new Error(res.msg || '获取节点失败')
  return res.data
}

export interface ChatHistoryItem {
  oId: string
  userName: string
  userNickname?: string
  userAvatarURL?: string
  content: string | RedPacketContent
  md?: string
  time?: string
  type?: string
}

export interface RedPacketContent {
  msgType?: string
  money?: number
  count?: number
  got?: number
  msg?: string
  type?: string
}

export interface MuteItem {
  userName: string
  userAvatarURL?: string
  time?: string
}
