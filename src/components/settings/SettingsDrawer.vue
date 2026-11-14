<script setup lang="ts">
import DragGrip from '@/components/home/DragGrip.vue'
import SidebarIcon from '@/chat/sidebar/SidebarIcon.vue'
import type { ChatSidebarModuleId } from '@/chat/sidebar/meta'
import SidebarModuleSettingsList from './SidebarModuleSettingsList.vue'
import { useAppearanceShopStore } from '@/stores/appearanceShop'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsDrawerStore, type SettingsSection } from '@/stores/settingsDrawer'
import { useHomeLayoutStore } from '@/stores/homeLayout'
import { usePageSidebarStore, type PageSidebarModuleId } from '@/stores/pageSidebar'
import { fish001 } from '@/emoji/fish001'
import { emojiOrderOptions, useEmojiPreferencesStore } from '@/stores/emojiPreferences'
import { useChatPreferencesStore } from '@/stores/chatPreferences'
import { usesMacSendModifier } from '@/utils/chatSendShortcut'
import { useChatSidebarStore } from '@/stores/chatSidebar'
import { useChatFilterStore, type ChatBlockMatch, type ChatBlockMode } from '@/stores/chatFilter'
import { useAuthStore } from '@/stores/auth'
import { usePrivateInboxStore } from '@/stores/privateInbox'
import { useCountStore } from '@/stores/count'
import { feedbackEnabled } from '@/feedback/api'
import FeedbackDialog from '@/feedback/FeedbackDialog.vue'
import { useFeedbackPanelStore } from '@/feedback/panel'
import LocalBrandingSettings from './LocalBrandingSettings.vue'
import IncomeCard from '@/components/count/IncomeCard.vue'
import HiddenChatConversations from '@/components/chat/HiddenChatConversations.vue'
import WhisperConversations from '@/components/chat/WhisperConversations.vue'
import ChatTailSettingsDialog from '@/components/chat/ChatTailSettingsDialog.vue'

const drawer = useSettingsDrawerStore()
const appearanceShop = useAppearanceShopStore()
const feedbackPanel = useFeedbackPanelStore()
const { open, section } = storeToRefs(drawer)
const home = useHomeLayoutStore()
const pageSidebar = usePageSidebarStore()
const sidebar = useChatSidebarStore()
const chatPreferences = useChatPreferencesStore()
const defaultSendShortcutLabel = usesMacSendModifier() ? 'Command+Enter' : 'Ctrl+Enter'
const emojiPreferences = useEmojiPreferencesStore()
const chatFilter = useChatFilterStore()
const auth = useAuthStore()
const whispers = usePrivateInboxStore()
const count = useCountStore()
const route = useRoute()
const router = useRouter()

const mounted = ref(false)
const hiddenChatsOpen = ref(false)
const chatTailOpen = ref(false)
function openChatTail() {
  if (!auth.isLoggedIn) return
  drawer.hide()
  chatTailOpen.value = true
}
const { isLoggedIn } = storeToRefs(auth)
const { unreadTotal: whisperUnread,error: whisperUnreadError, inboxOpen: whisperInboxOpen } = storeToRefs(whispers)
const blockForm = reactive({ match: 'nickname' as ChatBlockMatch, value: '', mode: 'block' as ChatBlockMode })
const isChatroom = computed(() => route.path === '/cr')
const isHome = computed(() => route.path === '/')
const showHiddenHandle = computed(() => (isChatroom.value || isHome.value) && chatFilter.enabled)
watch([showHiddenHandle], ([visible]) => {
  if (!visible) hiddenChatsOpen.value = false
})

type SettingsGroup = 'layout' | 'chat' | 'personal' | 'help'
const SECTIONS: { id: SettingsSection; label: string; description: string; icon: ChatSidebarModuleId | 'settings'; group: SettingsGroup }[] = [
  { id: 'home', label: '首页模块', description: '选择首页内容，调整模块的位置与排列。', icon: 'ad', group: 'layout' },
  { id: 'pageSidebar', label: '内页侧栏', description: '常用模块独立展示，其余收进标签页。', icon: 'ad', group: 'layout' },
  { id: 'chatSidebar', label: '聊天室侧栏', description: '为聊天保留常看的信息，按你的习惯排列。', icon: 'online', group: 'layout' },
  { id: 'chatInput', label: '聊天室输入', description: '调整发送方式、小尾巴和聊天显示效果。', icon: 'topic', group: 'chat' },
  { id: 'emoji', label: '表情包', description: '选择喜欢的表情包和收藏顺序。', icon: 'appearance', group: 'chat' },
  { id: 'chatBlock', label: '聊天室屏蔽', description: '按昵称、UID 或关键词管理你想看到的消息。', icon: 'mutes', group: 'chat' },
  { id: 'branding', label: '站点外观', description: '自定义本机的站点名称、Logo 和标签页图标。', icon: 'appearance', group: 'personal' },
  { id: 'income', label: '上下班时间', description: '设置工作时间，让倒计时和收入展示更贴合你。', icon: 'income', group: 'personal' },
  ...(feedbackEnabled ? [{ id: 'feedback' as const, label: '需求反馈', description: '分享建议、反馈问题，一起完善摸鱼派。', icon: 'topic' as const, group: 'help' as const }] : []),
]
const visibleSections = computed(() => SECTIONS.filter(item => item.id !== 'income' || sidebar.isOn('income') || pageSidebar.isOn('income')))
const groups = computed(() => [
  { id: 'layout', label: '页面布局' },
  { id: 'chat', label: '聊天体验' },
  { id: 'personal', label: '个性化' },
  { id: 'help', label: '帮助与反馈' },
].map(group => ({ ...group, items: visibleSections.value.filter(item => item.group === group.id) })).filter(group => group.items.length))
const currentSection = computed(() => visibleSections.value.find(item => item.id === section.value))
function openAppearanceShop() {
  drawer.hide()
  appearanceShop.show()
}
const pageModuleOn = (id: string) => pageSidebar.isOn(id as PageSidebarModuleId)
const pageModulePresentation = (id: string) => pageSidebar.presentationOf(id as PageSidebarModuleId)

const homeCore = computed(() => home.orderedModules.filter((m) => !m.sidebarId))
const homeSide = computed(() => home.orderedModules.filter((m) => m.sidebarId))

watch(
  () => sidebar.isOn('income') || pageSidebar.isOn('income'),
  (isOn) => {
    if (!isOn && section.value === 'income') section.value = 'pageSidebar'
  },
  { immediate: true },
)

function addChatBlockRule() {
  chatFilter.addRule(blockForm.match, blockForm.value, blockForm.mode)
  blockForm.value = ''
}

function openWhisperInbox() {
  const currentPeer = route.path.startsWith('/chat/') ? String(route.params.userName || '') : ''
  whispers.showInbox(currentPeer||String(route.query.toUser||''),String(route.query.peerId||''))
}

async function startHomeEdit() {
  drawer.hide()
  if (route.path !== '/') await router.push('/')
  home.editing = true
}

const form = reactive({ startTime: '09:00', time: '18:00', lunch: '11:30', salary: '365' })
const saved = ref(false)

function toInput(hhmm: string) {
  const [h, m] = hhmm.match(/\d{2}/g) || ['00', '00']
  return `${h}:${m}`
}

function fillForm() {
  const d = count.data
  form.startTime = toInput(d.startTime)
  form.time = toInput(d.time)
  form.lunch = toInput(d.lunch)
  form.salary = d.salary
  saved.value = false
}

function saveIncome() {
  count.update({
    startTime: form.startTime.replace(':', ''),
    time: form.time.replace(':', ''),
    lunch: form.lunch.replace(':', ''),
    salary: String(form.salary ?? '0').trim() || '0',
  })
  saved.value = true
}

watch([open, section], ([o, s]) => {
  if (o && s === 'income') fillForm()
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) drawer.hide()
}

onMounted(() => {
  mounted.value = true
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <button
      type="button"
      class="fp-set-handle"
      :class="{ active: open }"
      aria-label="打开设置"
      title="设置"
      @click="open ? drawer.hide() : drawer.show()"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        />
        <path
          d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <button
      v-if="showHiddenHandle"
      type="button"
      class="fp-hidden-handle"
      aria-label="打开隐藏会话"
      title="隐藏会话"
      @click="hiddenChatsOpen = true"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 3v-3a2 2 0 0 1-3-2v-8a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
        <path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
      </svg>
    </button>
    <button
      v-if="isLoggedIn"
      type="button"
      class="fp-whisper-handle"
      :class="{ 'after-hidden': showHiddenHandle }"
      aria-label="打开聊天"
      :title="whisperUnreadError||(whisperUnread?`聊天（${whisperUnread} 条未读）`:'聊天')"
      @click="openWhisperInbox"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 3v-3H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
      </svg>
      <span v-if="whisperUnread" class="unread-badge">{{ (whisperUnread||0) > 99 ? '99+' : whisperUnread }}</span>
    </button>
    <HiddenChatConversations v-model="hiddenChatsOpen" />
    <WhisperConversations v-model="whisperInboxOpen" />

    <Transition name="fp-set-mask">
      <div v-if="open" class="fp-set-mask" @click="drawer.hide()" />
    </Transition>

    <Transition name="fp-set-panel">
      <aside v-if="open" class="fp-set-panel" role="dialog" aria-label="设置">
        <nav class="nav" aria-label="设置分类">
          <div class="brand"><b>设置</b><span>按你的习惯使用摸鱼派</span></div>
          <div v-for="group in groups" :key="group.id" class="nav-group">
            <p class="nav-group-title">{{ group.label }}</p>
            <div class="nav-group-items">
              <button
                v-for="item in group.items" :key="item.id" type="button" class="nav-item"
                :class="{ on: section === item.id }" :aria-current="section === item.id ? 'page' : undefined"
                @click="section = item.id"
              ><SidebarIcon :name="item.icon" /><span>{{ item.label }}</span></button>
              <button v-if="group.id === 'personal'" type="button" class="nav-item nav-shop" @click="openAppearanceShop">
                <SidebarIcon name="appearance" /><span>外观商城</span><span class="nav-external" aria-hidden="true">↗</span>
              </button>
            </div>
          </div>
        </nav>

        <div class="body">
          <header class="head">
            <div><h2>{{ currentSection?.label }}</h2><p>{{ currentSection?.description }}</p></div>
            <button type="button" class="close" aria-label="关闭设置" @click="drawer.hide()">✕</button>
          </header>

          <div v-if="section === 'feedback'" class="content">
            <button class="drag-entry" @click="drawer.hide(); feedbackPanel.show('/feedback/new')"><b>提需求</b><span>描述你的想法或遇到的问题</span></button>
            <button class="drag-entry" @click="drawer.hide(); feedbackPanel.show('/feedback')"><b>查看需求列表</b><span>查看处理进展，为感兴趣的需求投票</span></button>
          </div>
          <div v-else-if="section === 'branding'" class="content"><LocalBrandingSettings /><button type="button" class="shop-entry" @click="openAppearanceShop"><SidebarIcon name="appearance" /><span><b>外观商城</b><small>挑选座驾、气泡和头像框</small></span><span aria-hidden="true">↗</span></button></div>
          <div v-else-if="section === 'home'" class="content">
            <fieldset class="setting-options"><legend>首页版本</legend><label :class="{ selected: home.mode === 'compact' }"><input type="radio" name="home-variant" value="compact" :checked="home.mode === 'compact'" @change="home.setMode('compact')" /><span><b>紧凑版</b><small>最新、长篇和聊天优先进入首屏</small></span></label><label :class="{ selected: home.mode === 'classic' }"><input type="radio" name="home-variant" value="classic" :checked="home.mode === 'classic'" @change="home.setMode('classic')" /><span><b>经典版</b><small>保留原来的双列最新与分行布局</small></span></label><p>两个版本分别保存模块位置与显隐，仅在此浏览器生效。</p></fieldset>
            <button type="button" class="drag-entry" @click="startHomeEdit">
              <b><DragGrip /> 拖动调整布局</b>
              <span>在首页直接拖动模块，左中右、上下任意摆放</span>
            </button>
            <div class="chips">
              <button type="button" @click="home.applyPreset(6)">精简</button>
              <button type="button" @click="home.applyPreset(99)">全部显示</button>
              <button type="button" @click="home.reset()">恢复默认</button>
            </div>
            <p class="group">首页</p>
            <ul class="rows">
              <li v-for="m in homeCore" :key="m.id">
                <label class="check">
                  <input type="checkbox" :checked="!home.isHidden(m.id)" @change="home.toggle(m.id)" />
                  <span>{{ m.title }}</span>
                </label>
              </li>
            </ul>
            <p class="group">来自聊天室侧栏</p>
            <ul class="rows">
              <li v-for="m in homeSide" :key="m.id">
                <label class="check">
                  <input type="checkbox" :checked="!home.isHidden(m.id)" @change="home.toggle(m.id)" />
                  <span>{{ m.title }}</span>
                </label>
              </li>
            </ul>
          </div>

          <div v-else-if="section === 'pageSidebar'" class="content sidebar-settings">
            <div class="placement-guide"><p><b>独立卡片</b><span>直接可见，可以折叠</span></p><p><b>标签页</b><span>集中展示，点击切换</span></p></div>
            <p class="drag-hint">标签集中在同一面板，独立卡片按顺序排列。</p>
            <div class="sidebar-settings-toolbar">
              <span>模块与顺序</span>
              <div class="chips">
                <button type="button" @click="pageSidebar.applyPreset('compact')">精简</button>
                <button type="button" @click="pageSidebar.applyPreset('all')">全部显示</button>
                <button type="button" @click="pageSidebar.reset()">恢复默认</button>
              </div>
            </div>
            <SidebarModuleSettingsList
              :modules="pageSidebar.orderedModules" :is-on="pageModuleOn" :presentation-of="pageModulePresentation"
              @toggle="id => pageSidebar.toggle(id as PageSidebarModuleId)"
              @presentation="(id, mode) => pageSidebar.setPresentation(id as PageSidebarModuleId, mode)"
              @move-to="(id, target, after) => pageSidebar.moveTo(id as PageSidebarModuleId, target as PageSidebarModuleId, after)"
            />
            <p class="placement-note">我的资料固定置顶。拖动九点手柄或使用箭头排序；标签页会合并显示在首个标签模块的位置。设置自动保存在此浏览器。</p>
          </div>

          <div v-else-if="section === 'chatInput'" class="content">
            <label class="setting-toggle" :class="{ selected: chatPreferences.simpleMode }"><input type="checkbox" :checked="chatPreferences.simpleMode" @change="chatPreferences.setSimpleMode(($event.target as HTMLInputElement).checked)"><span><b>精简模式</b><small>隐藏头像框、气泡、小尾巴和进出场效果</small></span></label>
            <label class="setting-toggle" :class="{ selected: chatPreferences.mountEffects, 'is-disabled': chatPreferences.simpleMode }"><input type="checkbox" :disabled="chatPreferences.simpleMode" :checked="chatPreferences.mountEffects" @change="chatPreferences.setMountEffects(($event.target as HTMLInputElement).checked)"><span><b>显示座驾进场特效</b></span></label>
            <div class="setting-options"><button type="button" class="fp-btn" :disabled="!isLoggedIn" @click="openChatTail">小尾巴设置</button><small v-if="!isLoggedIn">登录后可设置</small></div>
            <fieldset class="setting-options">
              <legend>发送快捷键</legend>
              <label :class="{ selected: chatPreferences.sendShortcut === 'mod-enter' }">
                <input type="radio" name="chat-send-shortcut" value="mod-enter" :checked="chatPreferences.sendShortcut === 'mod-enter'" @change="chatPreferences.setSendShortcut('mod-enter')" />
                <span><b>{{ defaultSendShortcutLabel }} 发送（默认）</b><small>Enter 换行</small></span>
              </label>
              <label :class="{ selected: chatPreferences.sendShortcut === 'enter' }">
                <input type="radio" name="chat-send-shortcut" value="enter" :checked="chatPreferences.sendShortcut === 'enter'" @change="chatPreferences.setSendShortcut('enter')" />
                <span><b>Enter 发送</b><small>Shift+Enter 换行</small></span>
              </label>
            </fieldset>
          </div>

          <div v-else-if="section === 'emoji'" class="content">
            <fieldset class="setting-options">
              <legend>可选表情包</legend>
              <label :class="{ selected: emojiPreferences.fish001Enabled }">
                <input type="checkbox" :checked="emojiPreferences.fish001Enabled"
                  @change="emojiPreferences.setFish001Enabled(($event.target as HTMLInputElement).checked)" />
                <span><b>{{ fish001.name }}</b><small>{{ fish001.items.length }} 张表情</small></span>
              </label>
            </fieldset>
            <fieldset class="setting-options">
              <legend>表情收藏排序</legend>
              <label v-for="(label, order) in emojiOrderOptions" :key="order" :class="{ selected: emojiPreferences.order === order }">
                <input type="radio" name="emoji-collection-order" :value="order" :checked="emojiPreferences.order === order"
                  @change="emojiPreferences.setOrder(order)" />
                <span><b>{{ label }}</b></span>
              </label>
            </fieldset>
          </div>

          <div v-else-if="section === 'chatSidebar'" class="content sidebar-settings">
            <div class="placement-guide"><p><b>独立卡片</b><span>直接可见，可以折叠</span></p><p><b>标签页</b><span>集中展示，点击切换</span></p></div>
            <p class="drag-hint">标签集中在同一面板，独立卡片按顺序排列。</p>
            <div class="sidebar-settings-toolbar">
              <span>模块与顺序</span>
              <div class="chips">
                <button type="button" @click="sidebar.reset()">恢复默认</button>
              </div>
            </div>
            <SidebarModuleSettingsList
              :modules="sidebar.orderedModules" :is-on="sidebar.isOn" :presentation-of="sidebar.presentationOf"
              @toggle="id => sidebar.toggle(id)"
              @presentation="(id, mode) => sidebar.setPresentation(id, mode)"
              @move-to="(id, target, after) => sidebar.moveTo(id, target, after)"
            />
            <p class="placement-note">我的资料固定置顶。拖动九点手柄或使用箭头排序；标签页会合并显示在首个标签模块的位置。设置自动保存在此浏览器。</p>
          </div>

          <div v-else-if="section === 'chatBlock'" class="content">
            <label class="check block-enable">
              <input v-model="chatFilter.enabled" type="checkbox" />
              <span>启用聊天室屏蔽</span>
            </label>
            <p class="drag-hint">规则仅保存在此浏览器。昵称按显示昵称或用户名匹配，UID 按用户 ID 匹配，关键词按消息内容包含匹配（不区分大小写）。</p>
            <form class="block-form" @submit.prevent="addChatBlockRule">
              <select v-model="blockForm.match" class="fp-input" aria-label="屏蔽条件">
                <option value="nickname">昵称</option>
                <option value="uid">UID</option>
                <option value="keyword">关键词</option>
              </select>
              <input
                v-model="blockForm.value"
                class="fp-input"
                :placeholder="
                  blockForm.match === 'uid'
                    ? '输入用户 ID'
                    : blockForm.match === 'keyword'
                      ? '输入要匹配的关键词'
                      : '输入昵称或用户名'
                "
                required
              />
              <select v-model="blockForm.mode" class="fp-input" aria-label="屏蔽方式">
                <option value="block">完全屏蔽</option>
                <option value="hide">移入隐藏列表</option>
              </select>
              <button type="submit" class="fp-btn fp-btn--primary">添加</button>
            </form>
            <p class="group">屏蔽规则 <small>{{ chatFilter.rules.length }}</small></p>
            <p v-if="!chatFilter.rules.length" class="block-empty">还没有屏蔽规则</p>
            <ul v-else class="block-rules">
              <li v-for="rule in chatFilter.rules" :key="rule.id">
                <span class="rule-target">
                  <small>{{ rule.match === 'uid' ? 'UID' : rule.match === 'keyword' ? '关键词' : '昵称' }}</small>
                  <b>{{ rule.value }}</b>
                </span>
                <select
                  :value="rule.mode"
                  class="rule-mode"
                  :aria-label="`设置 ${rule.value} 的屏蔽方式`"
                  @change="chatFilter.setMode(rule.id, ($event.target as HTMLSelectElement).value as ChatBlockMode)"
                >
                  <option value="block">完全屏蔽</option>
                  <option value="hide">移入隐藏列表</option>
                </select>
                <button type="button" class="remove-rule" :aria-label="`移除 ${rule.value} 屏蔽规则`" @click="chatFilter.removeRule(rule.id)">✕</button>
              </li>
            </ul>
          </div>

          <form v-else-if="section === 'income'" class="content" @submit.prevent="saveIncome">
            <div class="preview"><IncomeCard /></div>
            <div class="grid">
              <label class="field">
                <span>上班时间</span>
                <input v-model="form.startTime" class="fp-input" type="time" required />
              </label>
              <label class="field">
                <span>下班时间</span>
                <input v-model="form.time" class="fp-input" type="time" required />
              </label>
              <label class="field">
                <span>午饭时间</span>
                <input v-model="form.lunch" class="fp-input" type="time" required />
              </label>
              <label class="field">
                <span>日薪（0 不显示）</span>
                <input v-model="form.salary" class="fp-input" type="number" min="0" step="0.01" />
              </label>
            </div>
            <div class="foot">
              <span v-if="saved" class="ok">已保存</span>
              <button type="submit" class="fp-btn fp-btn--primary">保存</button>
            </div>
          </form>
        </div>
      </aside>
    </Transition>
    <FeedbackDialog v-if="feedbackEnabled && feedbackPanel.open" />
    <ChatTailSettingsDialog :open="chatTailOpen" @close="chatTailOpen = false" />
  </Teleport>
</template>

<style scoped>
.setting-options { display:flex; flex-direction:column; gap:8px; margin:0 0 16px; padding:0; border:0; }
.setting-options legend { margin-bottom:8px; font-size:13px; font-weight:600; color:var(--fp-title); }
.setting-options label, .setting-toggle { display:flex; align-items:center; gap:10px; padding:12px; border:1px solid var(--fp-border); border-radius:8px; cursor:pointer; }
.setting-options label.selected, .setting-toggle.selected { border-color:var(--fp-primary); background:color-mix(in srgb,var(--fp-primary) 6%,var(--fp-card)); }
.setting-options span { display:flex; flex-direction:column; gap:4px; }.setting-options b { font-size:13px; color:var(--fp-title); }.setting-options small,.setting-options p { margin:0; font-size:11px; color:var(--fp-muted); line-height:1.6; }
.setting-options input { accent-color:var(--fp-primary); }
.setting-toggle { margin-bottom:12px; }
.setting-toggle input { flex:none; width:15px; height:15px; margin:0; accent-color:var(--fp-primary); }
.setting-toggle span { display:grid; gap:4px; min-width:0; }
.setting-toggle b { font-size:13px; color:var(--fp-title); }
.setting-toggle small { font-size:11px; color:var(--fp-muted); line-height:1.6; }
.setting-toggle.is-disabled { opacity:.55; cursor:default; }
</style>

<style scoped>
.fp-set-handle {
  position: fixed;
  left: 0;
  top: 50%;
  z-index: 1190;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 38px;
  transform: translateY(-50%);
  border: 1px solid var(--fp-border);
  border-left: 0;
  border-radius: 0 9px 9px 0;
  background: var(--fp-card);
  color: var(--fp-muted);
  cursor: pointer;
  transition: color 0.2s, background 0.2s, transform 0.2s ease;
}
.fp-set-handle:hover,
.fp-set-handle.active {
  background: var(--fp-hover);
  color: var(--fp-link);
}
.fp-set-handle:hover {
  transform: translate(4px, -50%);
}
.fp-set-handle svg {
  width: 16px;
  height: 16px;
  transition: transform 0.35s ease;
}
.fp-set-handle:hover svg {
  transform: rotate(45deg);
}
.fp-hidden-handle {
  position: fixed;
  left: 0;
  top: calc(50% + 30px);
  z-index: 1190;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 38px;
  border: 1px solid var(--fp-border);
  border-left: 0;
  border-radius: 0 9px 9px 0;
  background: var(--fp-card);
  color: var(--fp-muted);
  cursor: pointer;
  transition: color 0.2s, background 0.2s, transform 0.2s ease;
}
.fp-hidden-handle:hover {
  background: var(--fp-hover);
  color: var(--fp-link);
  transform: translateX(4px);
}
.fp-hidden-handle svg {
  width: 16px;
  height: 16px;
  transition: transform 0.2s ease;
}
.fp-hidden-handle:hover svg {
  transform: scale(1.12);
}
.fp-whisper-handle {
  position: fixed;
  left: 0;
  top: calc(50% + 30px);
  z-index: 1190;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 38px;
  border: 1px solid var(--fp-border);
  border-left: 0;
  border-radius: 0 9px 9px 0;
  background: var(--fp-card);
  color: var(--fp-muted);
  cursor: pointer;
  transition: color 0.2s, background 0.2s, transform 0.2s ease, top 0.24s ease;
}
.fp-whisper-handle.after-hidden {
  top: calc(50% + 74px);
}
.fp-whisper-handle:hover {
  transform: translateX(4px);
  background: var(--fp-hover);
  color: var(--fp-link);
}
.fp-whisper-handle svg {
  width: 16px;
  height: 16px;
  transition: transform 0.2s ease;
}
.fp-whisper-handle:hover svg {
  transform: scale(1.12);
}
.unread-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 16px;
  padding: 2px 4px;
  border-radius: var(--fp-panel-radius);
  background: var(--fp-accent);
  color: #fff;
  font-size: 9px;
  line-height: 1.2;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .fp-set-handle,
  .fp-set-handle svg,
  .fp-hidden-handle,
  .fp-hidden-handle svg,
  .fp-whisper-handle,
  .fp-whisper-handle svg {
    transition: none;
  }
}

.fp-set-mask {
  position: fixed;
  inset: 0;
  z-index: 1191;
  background: rgba(0, 0, 0, 0.15);
}

.fp-set-panel {
  position: fixed;
  left: 12px;
  top: 50%;
  z-index: 1192;
  display: grid;
  grid-template-columns: 174px minmax(0, 1fr);
  width: min(744px, calc(100vw - 24px));
  height: min(720px, calc(100dvh - 48px));
  transform: translateY(-50%);
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius);
  background: var(--fp-card);
  box-shadow: 0 20px 70px rgba(0, 0, 0, 0.18);
  overflow: hidden;
  color: var(--fp-text);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 19px;
  min-height: 0;
  overflow-y: auto;
  padding: 22px 12px;
  border-right: 1px solid var(--fp-border);
  background: color-mix(in srgb, var(--fp-hover) 65%, var(--fp-card));
}
.brand { display: grid; gap: 7px; padding: 0 10px 4px; }
.brand b { font-size: 19px; color: var(--fp-title); }
.brand span { color: var(--fp-muted); font-size: 10px; white-space: nowrap; }
.nav-group-title { margin: 0 10px 7px; color: var(--fp-muted); font-size: 10px; }
.nav-group-items { display: flex; flex-direction: column; gap: 3px; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--fp-text);
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  text-align: left;
  cursor: pointer;
  transition: color 150ms, background 150ms;
}
.nav-item svg { flex: none; width: 16px; height: 16px; color: var(--fp-muted); }
.nav-item:hover { background: var(--fp-hover); }
.nav-item.on { background: color-mix(in srgb, var(--fp-primary) 10%, var(--fp-card)); color: var(--fp-primary); font-weight: 600; }
.nav-item.on svg { color: inherit; }
.nav-external { margin-left: auto; color: var(--fp-muted); }

.body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.head {
  display: flex;
  flex: none;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 23px 24px 20px;
  border-bottom: 1px solid var(--fp-border);
}
.head h2 { margin: 0; color: var(--fp-title); font-size: 18px; font-weight: 650; line-height: 1.5; }
.head p { margin: 6px 0 0; color: var(--fp-muted); font-size: 12px; line-height: 1.7; }
.close {
  display: grid;
  flex: none;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 7px;
  background: var(--fp-hover);
  color: var(--fp-muted);
  font-size: 15px;
  cursor: pointer;
}
.close:hover { color: var(--fp-title); }
.content { flex: 1; min-height: 0; overflow: auto; padding: 22px 24px; overscroll-behavior: contain; }
.placement-guide { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 22px; }
.placement-guide p { display: grid; gap: 5px; margin: 0; padding: 12px 14px; border-radius: 8px; background: var(--fp-hover); }
.placement-guide b { color: var(--fp-title); font-size: 12px; font-weight: 550; }
.placement-guide span { color: var(--fp-muted); font-size: 11px; }
.sidebar-settings-toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.sidebar-settings-toolbar > span { color: var(--fp-muted); font-size: 11px; }
.sidebar-settings-toolbar .chips { margin-bottom: 0; gap: 4px; }
.sidebar-settings-toolbar .chips button { padding: 4px 7px; font-size: 11px; }
.placement-note { margin: 14px 0 0; color: var(--fp-muted); font-size: 11px; line-height: 1.8; }
.shop-entry { display: flex; align-items: center; gap: 12px; width: 100%; padding: 15px; margin-top: 20px; border: 1px solid var(--fp-border); border-radius: 9px; background: var(--fp-card); color: var(--fp-text); text-align: left; cursor: pointer; }
.shop-entry svg { width: 21px; height: 21px; color: var(--fp-primary); }
.shop-entry span:first-of-type { display: grid; flex: 1; gap: 5px; }
.shop-entry b { font-size: 13px; font-weight: 550; }
.shop-entry small { font-size: 11px; color: var(--fp-muted); }
.shop-entry:hover { background: var(--fp-hover); }
.fp-set-panel button:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 2px; }

.drag-entry {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  width: 100%;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius);
  background: var(--fp-hover);
  color: var(--fp-title);
  text-align: left;
  cursor: pointer;
}
.drag-entry b {
  font-size: 13px;
}
.drag-entry span {
  font-size: 12px;
  color: var(--fp-muted);
}
.drag-entry:hover {
  background: color-mix(in srgb, var(--fp-primary) 8%, var(--fp-card));
}
.chips {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.chips button {
  border: 1px solid var(--fp-border);
  background: var(--fp-card);
  color: var(--fp-text);
  border-radius: var(--fp-radius-sm, 6px);
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}
.chips button:hover {
  border-color: var(--fp-border-strong, var(--fp-border));
  background: var(--fp-hover);
  color: var(--fp-primary);
}
.group {
  margin: 12px 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fp-head);
}
.group small {
  margin-left: 4px;
  font-weight: 400;
  color: var(--fp-muted);
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.rows li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--fp-radius-md, 8px);
  transition: background-color 0.15s ease;
}
.rows li:hover {
  background: var(--fp-hover);
}
.rows li.is-dragging {
  opacity: 0.45;
}
.rows li.is-drop-target {
  outline: 1px dashed var(--fp-link);
  outline-offset: -1px;
}
.check {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--fp-title);
  cursor: pointer;
  user-select: none;
}
.drag-hint,
.block-empty {
  margin: 0 0 10px;
  color: var(--fp-muted);
  font-size: 12px;
  line-height: 1.5;
}
.block-enable {
  margin-bottom: 8px;
}
.block-form {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 7px;
  align-items: center;
  margin: 12px 0;
}
.block-form .fp-input {
  min-width: 0;
}
.block-form button {
  justify-self: start;
}
.block-rules {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.block-rules li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 7px 8px;
  border-radius: 6px;
  background: var(--fp-hover);
}
.rule-target {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.rule-target small {
  flex: none;
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--fp-card);
  color: var(--fp-muted);
  font-size: 10px;
}
.rule-target b {
  overflow: hidden;
  color: var(--fp-title);
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rule-mode {
  max-width: 130px;
  padding: 4px 5px;
  border: 1px solid var(--fp-border);
  border-radius: 5px;
  background: var(--fp-card);
  color: var(--fp-text);
  font: inherit;
  font-size: 11px;
}
.remove-rule {
  border: 0;
  background: transparent;
  color: var(--fp-muted);
  cursor: pointer;
}
.remove-rule:hover {
  color: var(--fp-accent);
}

.preview {
  padding: 12px 14px;
  margin-bottom: 12px;
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius);
  background: var(--fp-card);
}
.switch {
  margin-bottom: 12px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--fp-muted);
}
.foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
.ok {
  font-size: 12px;
  color: var(--fp-income);
}

.fp-set-mask-enter-active,
.fp-set-mask-leave-active {
  transition: opacity 0.2s;
}
.fp-set-mask-enter-from,
.fp-set-mask-leave-to {
  opacity: 0;
}
.fp-set-panel-enter-active,
.fp-set-panel-leave-active {
  transition:
    opacity 0.2s,
    transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.fp-set-panel-enter-from,
.fp-set-panel-leave-to {
  opacity: 0;
  transform: translate(-24px, -50%);
}

@media (max-width: 620px) {
  .fp-set-panel { left: 8px; width: calc(100vw - 16px); height: calc(100dvh - 24px); grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .nav { flex-direction: row; align-items: flex-start; gap: 18px; overflow-x: auto; overflow-y: hidden; padding: 13px 16px 12px; border-right: 0; border-bottom: 1px solid var(--fp-border); }
  .brand { display: none; }
  .nav-group { flex: none; }
  .nav-group-title { margin: 0 5px 6px; }
  .nav-group-items { flex-direction: row; gap: 3px; }
  .nav-item { width: auto; padding: 8px; }
  .nav-item svg { width: 14px; height: 14px; }
  .head { padding: 16px 18px 14px; gap: 8px; }
  .head h2 { font-size: 17px; }
  .head p { font-size: 11px; }
  .content { padding: 16px 18px 20px; }
  .placement-guide { gap: 8px; margin-bottom: 17px; }
  .placement-guide p { padding: 10px; }
  .block-form { grid-template-columns: minmax(0, 1fr); }
  .block-rules li { flex-wrap: wrap; }
  .rule-target { flex-basis: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .nav-item, .fp-set-mask-enter-active, .fp-set-mask-leave-active, .fp-set-panel-enter-active, .fp-set-panel-leave-active { transition: none; }
}
</style>
