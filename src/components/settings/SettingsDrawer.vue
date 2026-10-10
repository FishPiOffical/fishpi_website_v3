<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsDrawerStore, type SettingsSection } from '@/stores/settingsDrawer'
import { useHomeLayoutStore } from '@/stores/homeLayout'
import { useChatSidebarStore } from '@/stores/chatSidebar'
import { useChatFilterStore, type ChatBlockMatch, type ChatBlockMode } from '@/stores/chatFilter'
import { useAuthStore } from '@/stores/auth'
import { useWhisperStore } from '@/stores/whispers'
import { useCountStore } from '@/stores/count'
import IncomeCard from '@/components/count/IncomeCard.vue'
import HiddenChatConversations from '@/components/chat/HiddenChatConversations.vue'
import WhisperConversations from '@/components/chat/WhisperConversations.vue'

const drawer = useSettingsDrawerStore()
const { open, section } = storeToRefs(drawer)
const home = useHomeLayoutStore()
const sidebar = useChatSidebarStore()
const chatFilter = useChatFilterStore()
const auth = useAuthStore()
const whispers = useWhisperStore()
const count = useCountStore()
const route = useRoute()
const router = useRouter()

const mounted = ref(false)
const hiddenChatsOpen = ref(false)
const { isLoggedIn } = storeToRefs(auth)
const { unreadTotal: whisperUnread, inboxOpen: whisperInboxOpen } = storeToRefs(whispers)
const draggedSidebarId = ref('')
const overSidebarId = ref('')
const blockForm = reactive({ match: 'nickname' as ChatBlockMatch, value: '', mode: 'block' as ChatBlockMode })
const isChatroom = computed(() => route.path === '/cr')
const isHome = computed(() => route.path === '/')
const showHiddenHandle = computed(() => (isChatroom.value || isHome.value) && chatFilter.enabled)
watch([showHiddenHandle], ([visible]) => {
  if (!visible) hiddenChatsOpen.value = false
})

const SECTIONS: { id: SettingsSection; label: string; icon: string }[] = [
  { id: 'home', label: '首页模块', icon: '🏠' },
  { id: 'chatSidebar', label: '聊天室侧栏', icon: '💬' },
  { id: 'chatBlock', label: '聊天室屏蔽', icon: '🚫' },
  { id: 'income', label: '上下班时间', icon: '🕒' },
]

const visibleSections = computed(() => SECTIONS.filter((item) => item.id !== 'income' || sidebar.isOn('income')))
const homeCore = computed(() => home.orderedModules.filter((m) => !m.sidebarId))
const homeSide = computed(() => home.orderedModules.filter((m) => m.sidebarId))

watch(
  () => sidebar.isOn('income'),
  (isOn) => {
    if (!isOn && section.value === 'income') section.value = 'chatSidebar'
  },
  { immediate: true },
)

function startSidebarDrag(e: DragEvent, id: string) {
  draggedSidebarId.value = id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
}

function dragOverSidebarItem(e: DragEvent, id: string) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  overSidebarId.value = id
}

function dropSidebarItem(e: DragEvent, id: string) {
  e.preventDefault()
  const draggedId = draggedSidebarId.value || e.dataTransfer?.getData('text/plain') || ''
  const row = e.currentTarget as HTMLElement
  const after = e.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2
  if (draggedId) sidebar.moveTo(draggedId, id, after)
  draggedSidebarId.value = ''
  overSidebarId.value = ''
}

function endSidebarDrag() {
  draggedSidebarId.value = ''
  overSidebarId.value = ''
}

function addChatBlockRule() {
  chatFilter.addRule(blockForm.match, blockForm.value, blockForm.mode)
  blockForm.value = ''
}

function openWhisperInbox() {
  const currentPeer = route.path.startsWith('/chat/') ? String(route.params.userName || '') : ''
  whispers.showInbox(currentPeer)
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
      :title="whisperUnread ? `聊天（${whisperUnread} 条未读）` : '聊天'"
      @click="openWhisperInbox"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 3v-3H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
      </svg>
      <span v-if="whisperUnread" class="unread-badge">{{ whisperUnread > 99 ? '99+' : whisperUnread }}</span>
    </button>
    <HiddenChatConversations v-model="hiddenChatsOpen" />
    <WhisperConversations v-model="whisperInboxOpen" />

    <Transition name="fp-set-mask">
      <div v-if="open" class="fp-set-mask" @click="drawer.hide()" />
    </Transition>

    <Transition name="fp-set-panel">
      <aside v-if="open" class="fp-set-panel" role="dialog" aria-label="设置">
        <nav class="nav">
          <b class="brand">设置</b>
          <button
            v-for="s in visibleSections"
            :key="s.id"
            type="button"
            class="nav-item"
            :class="{ on: section === s.id }"
            @click="section = s.id"
          >
            <span class="ico" aria-hidden="true">{{ s.icon }}</span>
            <span>{{ s.label }}</span>
          </button>
        </nav>

        <div class="body">
          <header class="head">
            <b>{{ visibleSections.find((s) => s.id === section)?.label }}</b>
            <button type="button" class="close" aria-label="关闭设置" @click="drawer.hide()">✕</button>
          </header>

          <div v-if="section === 'home'" class="content">
            <button type="button" class="drag-entry" @click="startHomeEdit">
              <b>⠿ 拖动调整布局</b>
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

          <div v-else-if="section === 'chatSidebar'" class="content">
            <p class="drag-hint">拖动 ⠿ 调整侧栏模块顺序，也可用右侧箭头微调。</p>
            <div class="chips">
              <button type="button" @click="sidebar.reset()">恢复默认</button>
            </div>
            <ul class="rows">
              <li
                v-for="m in sidebar.orderedModules"
                :key="m.id"
                :class="{ 'is-dragging': draggedSidebarId === m.id, 'is-drop-target': overSidebarId === m.id }"
                @dragover="dragOverSidebarItem($event, m.id)"
                @drop="dropSidebarItem($event, m.id)"
              >
                <label class="check">
                  <input type="checkbox" :checked="sidebar.isOn(m.id)" @change="sidebar.toggle(m.id)" />
                  <span>{{ m.title }}</span>
                </label>
                <span class="sort">
                  <span
                    class="drag-handle"
                    draggable="true"
                    role="button"
                    :aria-label="`拖动排序：${m.title}`"
                    title="按住拖动排序"
                    @dragstart="startSidebarDrag($event, m.id)"
                    @dragend="endSidebarDrag"
                  >⠿</span>
                  <button type="button" aria-label="上移" @click="sidebar.move(m.id, -1)">↑</button>
                  <button type="button" aria-label="下移" @click="sidebar.move(m.id, 1)">↓</button>
                </span>
              </li>
            </ul>
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
  </Teleport>
</template>

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
  border-radius: 10px;
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
  grid-template-columns: 128px 1fr;
  width: min(500px, calc(100vw - 24px));
  height: min(560px, calc(100vh - 96px));
  transform: translateY(-50%);
  border: 1px solid var(--fp-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--fp-card) 88%, transparent);
  backdrop-filter: blur(16px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28);
  overflow: hidden;
  color: var(--fp-text);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 8px;
  border-right: 1px solid var(--fp-border);
  background: color-mix(in srgb, var(--fp-hover) 60%, transparent);
}
.brand {
  padding: 0 8px 10px;
  font-size: 15px;
  color: var(--fp-title);
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--fp-text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.nav-item:hover {
  background: var(--fp-hover);
}
.nav-item.on {
  background: var(--fp-hover);
  color: var(--fp-link);
  font-weight: 600;
}
.ico {
  font-size: 14px;
}

.body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  font-size: 14px;
  color: var(--fp-title);
}
.close {
  border: 0;
  background: transparent;
  color: var(--fp-muted);
  font-size: 14px;
  cursor: pointer;
}
.close:hover {
  color: var(--fp-link);
}
.content {
  flex: 1;
  overflow: auto;
  padding: 0 16px 16px;
}

.drag-entry {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  width: 100%;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px dashed var(--fp-link);
  border-radius: 10px;
  background: color-mix(in srgb, var(--fp-link) 8%, transparent);
  color: var(--fp-link);
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
  background: color-mix(in srgb, var(--fp-link) 14%, transparent);
}
.chips {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.chips button,
.sort button {
  border: 1px solid var(--fp-border);
  background: var(--fp-card);
  color: var(--fp-text);
  border-radius: 6px;
  padding: 3px 9px;
  font-size: 12px;
  cursor: pointer;
}
.chips button:hover,
.sort button:hover {
  color: var(--fp-link);
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
  gap: 2px;
}
.rows li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
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
  gap: 8px;
  font-size: 13px;
  color: var(--fp-title);
  cursor: pointer;
}
.sort {
  display: flex;
  align-items: center;
  gap: 4px;
}
.sort button {
  padding: 1px 7px;
}
.drag-handle {
  padding: 0 3px;
  color: var(--fp-muted);
  font-size: 18px;
  line-height: 1;
  cursor: grab;
  touch-action: none;
}
.drag-handle:active {
  cursor: grabbing;
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
  border-radius: 10px;
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
</style>
