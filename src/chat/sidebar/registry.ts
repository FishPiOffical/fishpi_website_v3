import type { Component } from 'vue'
import AdModule from './modules/AdModule.vue'
import AppearanceModule from './modules/AppearanceModule.vue'
import MutesModule from './modules/MutesModule.vue'
import OnlineModule from './modules/OnlineModule.vue'
import TopicModule from './modules/TopicModule.vue'

export interface ChatSidebarModule {
  id: string
  title: string
  defaultOn: boolean
  component: Component
}

export const CHAT_SIDEBAR_MODULES: ChatSidebarModule[] = [
  { id: 'topic', title: '当前话题', defaultOn: true, component: TopicModule },
  { id: 'online', title: '在线成员', defaultOn: true, component: OnlineModule },
  { id: 'appearance', title: '外观', defaultOn: true, component: AppearanceModule },
  { id: 'ad', title: '广告', defaultOn: true, component: AdModule },
  { id: 'mutes', title: '思过崖', defaultOn: false, component: MutesModule },
]
