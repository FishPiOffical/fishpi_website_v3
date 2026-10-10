import type { Component } from 'vue'
import AdModule from './modules/AdModule.vue'
import ActivityModule from './modules/ActivityModule.vue'
import AppearanceModule from './modules/AppearanceModule.vue'
import BarrageModule from './modules/BarrageModule.vue'
import IncomeModule from './modules/IncomeModule.vue'
import MutesModule from './modules/MutesModule.vue'
import OnlineModule from './modules/OnlineModule.vue'
import TopicModule from './modules/TopicModule.vue'
import { CHAT_SIDEBAR_META, type ChatSidebarModuleId, type ChatSidebarModuleMeta } from './meta'

export interface ChatSidebarModule extends ChatSidebarModuleMeta {
  component: Component
}

const COMPONENTS: Record<ChatSidebarModuleId, Component> = {
  income: IncomeModule,
  topic: TopicModule,
  online: OnlineModule,
  activity: ActivityModule,
  barrage: BarrageModule,
  appearance: AppearanceModule,
  ad: AdModule,
  mutes: MutesModule,
}

export const CHAT_SIDEBAR_MODULES: ChatSidebarModule[] = CHAT_SIDEBAR_META.map((m) => ({
  ...m,
  component: COMPONENTS[m.id],
}))

export function sidebarModule(id: string): ChatSidebarModule | undefined {
  return CHAT_SIDEBAR_MODULES.find((m) => m.id === id)
}
