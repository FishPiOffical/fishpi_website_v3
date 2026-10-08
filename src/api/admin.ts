/**
 * 管理后台数据层。现网 /admin 为 FTL SSR，无公开 JSON；
 * 优先尝试建议中的 /api/admin/*，失败则回退 admin.mock。
 */
import {
  mockAdminArticles,
  mockAdminComments,
  mockAdminReports,
  mockAdminStat,
  mockAdminUsers,
  type AdminArticleRow,
  type AdminCommentRow,
  type AdminReportRow,
  type AdminStat,
  type AdminUserRow,
} from './admin.mock'
import { request } from './http'

interface Envelope<T> {
  code: number
  msg?: string
  data?: T
}

async function tryAdminGet<T>(path: string): Promise<T | null> {
  try {
    const res = await request<Envelope<T>>(path)
    if (!res.code && res.data != null) return res.data
  } catch {
    /* 未开放 */
  }
  return null
}

export async function fetchAdminStat(): Promise<AdminStat> {
  return (await tryAdminGet<AdminStat>('/api/admin/stats')) || { ...mockAdminStat }
}

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  return (await tryAdminGet<AdminUserRow[]>('/api/admin/users')) || [...mockAdminUsers]
}

export async function fetchAdminArticles(): Promise<AdminArticleRow[]> {
  return (await tryAdminGet<AdminArticleRow[]>('/api/admin/articles')) || [...mockAdminArticles]
}

export async function fetchAdminComments(): Promise<AdminCommentRow[]> {
  return (await tryAdminGet<AdminCommentRow[]>('/api/admin/comments')) || [...mockAdminComments]
}

export async function fetchAdminReports(): Promise<AdminReportRow[]> {
  return (await tryAdminGet<AdminReportRow[]>('/api/admin/reports')) || [...mockAdminReports]
}

export function isAdminAccount(account: { roleId?: string; userRole?: string } | null | undefined) {
  if (!account) return false
  const role = String(account.roleId || account.userRole || '').toLowerCase()
  return role.includes('admin')
}

export { adminNav } from './admin.mock'
