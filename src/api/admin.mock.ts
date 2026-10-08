/** 管理后台列表假数据（现网 /admin 为 FTL，无公开 JSON）。见 docs/MISSING_APIS.md */

export interface AdminStat {
  onlineVisitorCnt: number
  onlineMemberCnt: number
  maxOnlineVisitorCount: number
  memberCount: number
  articleCount: number
  cmtCount: number
  domainCount: number
  tagCount: number
}

export interface AdminUserRow {
  oId: string
  userName: string
  userNickname?: string
  userPoint?: number
  roleId?: string
  userStatus?: string
}

export interface AdminArticleRow {
  oId: string
  articleTitle: string
  articleAuthorName: string
  articleCreateTimeStr?: string
  articleStatus?: string
}

export interface AdminCommentRow {
  oId: string
  commentContent: string
  commentAuthorName: string
  commentCreateTimeStr?: string
}

export interface AdminReportRow {
  oId: string
  reportDataType: string
  reportDataId: string
  reportUserName: string
  reportMemo?: string
  reportHandleStatus?: string
}

export const mockAdminStat: AdminStat = {
  onlineVisitorCnt: 128,
  onlineMemberCnt: 42,
  maxOnlineVisitorCount: 3200,
  memberCount: 18600,
  articleCount: 54200,
  cmtCount: 312000,
  domainCount: 18,
  tagCount: 4200,
}

export const mockAdminUsers: AdminUserRow[] = [
  { oId: 'u1', userName: 'admin', userNickname: '管理员', userPoint: 99999, roleId: 'adminRole', userStatus: '正常' },
  { oId: 'u2', userName: 'demo', userNickname: '演示鱼油', userPoint: 1200, roleId: 'defaultRole', userStatus: '正常' },
  { oId: 'u3', userName: 'muted', userNickname: '禁言示例', userPoint: 10, roleId: 'defaultRole', userStatus: '禁言' },
]

export const mockAdminArticles: AdminArticleRow[] = [
  {
    oId: 'a1',
    articleTitle: '【假数据】社区公告示例',
    articleAuthorName: 'admin',
    articleCreateTimeStr: '2026-10-08',
    articleStatus: '正常',
  },
  {
    oId: 'a2',
    articleTitle: '【假数据】待审帖子',
    articleAuthorName: 'demo',
    articleCreateTimeStr: '2026-10-07',
    articleStatus: '待审',
  },
]

export const mockAdminComments: AdminCommentRow[] = [
  {
    oId: 'c1',
    commentContent: '假数据评论：写得不错',
    commentAuthorName: 'demo',
    commentCreateTimeStr: '2026-10-08',
  },
  {
    oId: 'c2',
    commentContent: '假数据评论：需要审核',
    commentAuthorName: 'muted',
    commentCreateTimeStr: '2026-10-07',
  },
]

export const mockAdminReports: AdminReportRow[] = [
  {
    oId: 'r1',
    reportDataType: '帖子',
    reportDataId: 'a2',
    reportUserName: 'demo',
    reportMemo: '疑似广告',
    reportHandleStatus: '未处理',
  },
]

export const adminNav = [
  { to: '/admin', label: '仪表盘', exact: true },
  { to: '/admin/users', label: '用户' },
  { to: '/admin/articles', label: '帖子' },
  { to: '/admin/comments', label: '评论' },
  { to: '/admin/breezemoons', label: '清风明月' },
  { to: '/admin/domains', label: '领域' },
  { to: '/admin/tags', label: '标签' },
  { to: '/admin/invitecodes', label: '邀请码' },
  { to: '/admin/roles', label: '角色' },
  { to: '/admin/reports', label: '举报' },
  { to: '/admin/misc', label: '杂项' },
  { to: '/admin/auditlog', label: '审计日志' },
] as const
