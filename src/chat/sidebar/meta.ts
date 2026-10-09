export type ChatSidebarModuleId = 'income' | 'topic' | 'online' | 'barrage' | 'appearance' | 'ad' | 'mutes'

export interface ChatSidebarModuleMeta {
  id: ChatSidebarModuleId
  title: string
  defaultOn: boolean
  /** 不依赖聊天室 WebSocket 状态，可放进首页模块 */
  portable: boolean
  /** 放进首页时是否默认显示 */
  homeDefaultOn?: boolean
}

export const CHAT_SIDEBAR_META: ChatSidebarModuleMeta[] = [
  { id: 'income', title: '今日收入', defaultOn: true, portable: true, homeDefaultOn: true },
  { id: 'topic', title: '当前话题', defaultOn: true, portable: false },
  { id: 'online', title: '在线成员', defaultOn: true, portable: false },
  { id: 'barrage', title: '弹幕花费', defaultOn: true, portable: true },
  { id: 'appearance', title: '外观', defaultOn: true, portable: true },
  { id: 'ad', title: '广告', defaultOn: false, portable: true },
  { id: 'mutes', title: '思过崖', defaultOn: false, portable: false },
]
