<script setup lang="ts">
import { chatPetStatusLabels, type ChatPetStatus, type ChatTail } from '@/api/v3-chat-messages'
import { useChatPreferencesStore } from '@/stores/chatPreferences'
import { useFunctionPreferencesStore } from '@/stores/functionPreferences'
import { formatDisplayTime } from '@/utils/time'

import { computed, inject, onMounted, ref } from 'vue'
import { CHAT_MENTION, chatMentionText } from '@/chat/mention'
import { RouterLink } from 'vue-router'
import CollectChatEmoji from '@/components/chat/CollectChatEmoji.vue'
import ChatQuoteCard from '@/components/chat/ChatQuoteCard.vue'
import ImageLightbox from '@/components/ImageLightbox.vue'
import MedalList from '@/components/medal/MedalList.vue'
import VipNickname from '@/components/user/VipNickname.vue'
import { DEFAULT_AVATAR, avatarThumbnail, rhyPicThumbnail } from '@/utils/avatar'
import { chatAppearanceSnapshot, type ChatAppearance } from '@/utils/chatAppearance'
import { isSingleImageMessage } from '@/utils/chatMessage'
import { extractChatQuotes, hasChatQuoteBody, type ChatQuote } from '@/utils/chatQuote'

const props = withDefaults(
  defineProps<{
    tail?: ChatTail
    petStatus?: ChatPetStatus
    appearance?: ChatAppearance
    userId?: string
    userName: string
    nickname?: string
    avatar?: string
    avatarSize?: number
    time?: string
    html?: string
    self?: boolean
    medals?: unknown
    vipNickname?: boolean
    chatroom?: boolean
    /** 红包、音乐和天气卡片由调用方标记为独立展示。 */
    standalone?: boolean
  }>(),
  { userId: '', nickname: '', avatar: '', avatarSize: 36, time: '', html: '', self: false, medals: undefined, vipNickname: false, chatroom: false, standalone: false },
)

const mention = inject(CHAT_MENTION, null)
const canMention = computed(() => props.chatroom && !props.self && !!chatMentionText(props.userName) && !!mention?.enabled())
const chatPreferences = useChatPreferencesStore()
const simpleMode = computed(() => mounted.value && props.chatroom && chatPreferences.simpleMode)
const functionPreferences = useFunctionPreferencesStore()
const thumbnailWidth = 400
const thumbnailHeight = 360
const previewLimit = 1024

const snapshot = computed(() => chatAppearanceSnapshot(props.appearance))
const zoomed = ref('')
const originalImage = ref('')
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const singleImage = computed(() => props.chatroom && isSingleImageMessage(props.html))
const display = computed(() => {
  const hasImages = /<img\b/i.test(props.html)
  const mayHaveQuotes = /<blockquote\b/i.test(props.html) && (props.html.includes('/breezemoons/') || props.html.includes('#chatroom'))
  const plain = { html: props.html, quotes: [] as ChatQuote[] }
  if (!props.chatroom || (!hasImages && !mayHaveQuotes)) return plain
  if (!mounted.value) return hasImages ? { ...plain, html: '' } : plain
  // 先在惰性模板里提取引用、替换图片地址，再交给 Vue 插入页面。
  const template = document.createElement('template')
  template.innerHTML = props.html
  const quotes = mayHaveQuotes ? extractChatQuotes(template.content, window.location.origin) : []
  if (!hasImages && !quotes.length) return plain
  if (quotes.length && !hasChatQuoteBody(template.content)) return { html: '', quotes }
  for (const img of template.content.querySelectorAll('img:not(.emoji)')) {
    const picture = img.closest('picture')
    if (!singleImage.value) {
      const media = picture ?? img
      const frame = document.createElement('span')
      frame.className = 'chat-image-frame'
      media.before(frame)
      frame.append(media)
    }
    const original = img.getAttribute('src')
    if (!original) continue
    const thumbnail = rhyPicThumbnail(original, thumbnailWidth, thumbnailHeight)
    if (thumbnail === original) continue
    img.setAttribute('src', thumbnail)
    img.setAttribute('data-chat-original', original)
    img.removeAttribute('srcset')
    picture?.querySelectorAll('source').forEach(source => source.remove())
  }
  return { html: template.innerHTML.trim(), quotes }
})
const isStandalone = computed(() => props.chatroom && (
  props.standalone || singleImage.value || (!display.value.html && display.value.quotes.length > 0)
))


function onAvatarError(e: Event) {
  const img = e.target as HTMLImageElement
  if (img.getAttribute('src') !== DEFAULT_AVATAR) img.src = DEFAULT_AVATAR
}

function onBodyClick(e: MouseEvent) {
  const img = (e.target as HTMLElement | null)?.closest('img')
  if (!img || img.classList.contains('emoji') || !img.closest('.vditor-reset')) return
  e.preventDefault()
  const displayed = img.currentSrc || img.src
  const original = img.getAttribute('data-chat-original')
  const source = img.getAttribute('src')
  if (props.chatroom && original && source !== original && source === rhyPicThumbnail(original, thumbnailWidth, thumbnailHeight)) {
    originalImage.value = original
    zoomed.value = rhyPicThumbnail(original, previewLimit, previewLimit)
  } else {
    originalImage.value = displayed
    zoomed.value = displayed
  }
}
</script>

<template>
  <article :data-appearance-snapshot="chatroom ? 'v1' : undefined" :data-bubble="chatroom ? (simpleMode ? 'none' : snapshot.bubbleId) : undefined" :data-frame="chatroom ? (simpleMode ? 'none' : snapshot.frameId) : undefined" class="fp-msg" :class="{ 'is-simple': simpleMode, 'blur-chat-images': mounted && chatroom && functionPreferences.blurChatImages, 'is-self': self, 'is-room': chatroom, 'is-standalone': isStandalone, 'is-image': singleImage }">
    <RouterLink :to="`/member/${userName}`" class="fp-avatar-frame" :data-user-card="userName" :title="userName" :aria-label="`查看 ${nickname || userName} 的主页`">
      <img class="fp-avatar" :src="avatarThumbnail(avatar, avatarSize)" alt="" loading="lazy" @error="onAvatarError" />
    </RouterLink>
    <div class="message-stack">
      <div v-if="chatroom" class="head">
        <div class="chat-author">
          <component :is="canMention ? 'button' : RouterLink" v-bind="canMention ? { type: 'button' } : { to: `/member/${userName}` }" class="name" :class="{ 'name--mention': canMention }" :data-user-card="canMention ? undefined : userName" :aria-label="canMention ? `点击 @${nickname || userName}` : undefined" @click="canMention && mention?.insert(userName)">
            <span v-if="canMention" class="mention-prefix" aria-hidden="true">@</span>
            <span class="chat-author-name">
              <VipNickname v-if="vipNickname" :user-id="userId" :user-name="userName">
                {{ nickname || userName }}
              </VipNickname>
              <template v-else>{{ nickname || userName }}</template>
              <small v-if="nickname && nickname !== userName">({{ userName }})</small>
            </span>
          </component>
          <RouterLink v-if="petStatus && !simpleMode" :to="{ name: 'pets' }" class="fp-chat-pet-status" :data-species="petStatus.speciesId"
            :title="`宠物：${petStatus.name}${petStatus.level ? ' · Lv.' + petStatus.level : ''} · ${chatPetStatusLabels[petStatus.state]} · 前往宠物家园`">
            <span class="fp-chat-pet-name">{{ petStatus.name }}</span>
            <span v-if="petStatus.level" class="fp-chat-pet-level" :data-tier="Math.floor(petStatus.level / 10)">Lv.{{ petStatus.level }}</span>
            <span class="fp-chat-pet-state">{{ chatPetStatusLabels[petStatus.state] }}</span>
          </RouterLink>
        </div>
        <MedalList :items="medals" variant="chat" />
      </div>
      <div class="fp-bubble" @click="onBodyClick">
        <div v-if="!chatroom" class="head">
          <RouterLink :to="`/member/${userName}`" class="name">
            <VipNickname v-if="vipNickname" :user-id="userId" :user-name="userName">{{ nickname || userName }}</VipNickname>
            <template v-else>{{ nickname || userName }}</template>
            <small v-if="nickname && nickname !== userName">({{ userName }})</small>
          </RouterLink>
          <MedalList :items="medals" variant="chat" />
        </div>
        <slot>
          <div v-if="display.html" class="vditor-reset body" v-html="display.html" />
          <div v-if="display.quotes.length" class="chat-quote-stack">
            <ChatQuoteCard v-for="(quote, index) in display.quotes" :key="index" :quote="quote" />
          </div>
        </slot>
        <p v-if="chatroom && tail && !simpleMode && !isStandalone" class="fp-chat-tail" data-chat-tail><svg class="tail-label" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="小尾巴"><title>小尾巴</title><path fill="currentColor" stroke="none" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg><span class="tail-content">{{ tail.text }}</span></p>
        <template v-if="!chatroom">
          <slot name="reactions" />
          <div class="foot">
            <span class="actions"><slot name="actions" /></span>
            <time>{{ formatDisplayTime(time) }}</time>
          </div>
        </template>
      </div>
      <div v-if="chatroom" class="foot">
        <time>{{ formatDisplayTime(time) }}</time>
        <CollectChatEmoji v-if="/<img\b/i.test(html)" :html="html" />
        <div v-if="$slots.reactions" class="message-reactions"><slot name="reactions" /></div>
        <span v-if="$slots.actions" class="actions"><slot name="actions" /></span>
      </div>
    </div>
    <ImageLightbox v-model="zoomed" :original-src="originalImage" />
  </article>
</template>

<style scoped>
.fp-msg {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  max-width: 88%;
  overflow: visible;
}
.fp-msg.is-self {
  margin-left: auto;
  flex-direction: row-reverse;
}
.fp-avatar-frame {
  flex: none;
}
.message-stack {
  min-width: 0;
}
.fp-bubble {
  position: relative;
  min-width: 0;
  padding: 6px 12px 4px;
  border-radius: 6px;
  background: var(--fp-hover);
  overflow: visible;
  overflow-wrap: anywhere;
}
.chat-author {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}
.chat-author .name { min-width: 0; }
.chat-author-name {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fp-chat-pet-status {
  --pet-color: #758295;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 15em;
  padding: 1px 5px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--pet-color) 13%, transparent);
  font-size: 10px;
  line-height: 1.5;
  white-space: nowrap;
  color: color-mix(in srgb, var(--pet-color) 65%, var(--fp-text));
}
a.fp-chat-pet-status:hover,
a.fp-chat-pet-status:focus-visible {
  background: color-mix(in srgb, var(--pet-color) 23%, transparent);
  text-decoration: underline;
}
.fp-chat-pet-status[data-species="momota"] { --pet-color: #a76a45; }
.fp-chat-pet-status[data-species="hexiaotun"] { --pet-color: #5c913c; }
.fp-chat-pet-status[data-species="yubingmiao"] { --pet-color: #cc6b26; }
.fp-chat-pet-status[data-species="paixiaoyu"] { --pet-color: #448bb8; }
.fp-chat-pet-name { overflow: hidden; text-overflow: ellipsis; }
.fp-chat-pet-level {
  --level-color: #758295;
  flex: none;
  padding-inline: 3px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--level-color) 19%, transparent);
  color: color-mix(in srgb, var(--level-color) 65%, var(--fp-text));
  font-weight: 700;
}
.fp-chat-pet-level[data-tier="1"] { --level-color: #4383ce; }
.fp-chat-pet-level[data-tier="2"] { --level-color: #9564c5; }
.fp-chat-pet-level[data-tier="3"] { --level-color: #bd841f; }
.fp-chat-pet-state { flex: none; color: var(--fp-muted); }
.fp-chat-tail {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 8px 0 2px;
  padding-top: 6px;
  border-top: 1px solid color-mix(in srgb, var(--fp-muted) 22%, transparent);
  color: var(--fp-muted);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.tail-label {
  flex: none;
  width: 13px;
  height: 13px;
  align-self: flex-start;
  margin-top: 2px;
}
.tail-content { min-width: 0; }
.is-self .fp-bubble {
  background: var(--fp-self);
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
}
.is-self .head {
  flex-direction: row-reverse;
}
.name {
  padding: 0;
  border: 0;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
  display: block;
  font-size: 12px;
  line-height: 18px;
  color: var(--fp-muted);
  text-decoration: none;
}
/* 提及符号不占布局空间，悬浮时不会挤动昵称和勋章。 */
.name.name--mention { position: relative; }
.name.name--mention:hover,
.name.name--mention:focus-visible {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  text-decoration-color: color-mix(in srgb, currentColor 50%, transparent);
}
.mention-prefix {
  position: absolute;
  right: calc(100% + 2px);
  visibility: hidden;
}
.name--mention:hover .mention-prefix,
.name--mention:focus-visible .mention-prefix { visibility: visible; }
.name:hover { text-decoration: underline; text-underline-offset: 3px; }
.name:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
.is-self .name {
  text-align: right;
}
.name small {
  margin-left: 2px;
  font-size: 11px;
  opacity: 0.8;
}
.body {
  font-size: 14px;
  line-height: 1.55;
  color: var(--fp-text);
}
.body :deep(p) {
  margin: 0;
}
.body :deep(p + p) {
  margin-top: 4px;
}
.body :deep(img:not(.emoji)) {
  max-width: 150px;
  max-height: 200px;
  width: auto;
  height: auto;
  object-fit: contain;
  vertical-align: middle;
  border-radius: 4px;
  cursor: zoom-in;
}
.body :deep(img.emoji) {
  width: 22px;
  height: 22px;
  margin: 0 2px;
  vertical-align: -5px;
}
.body :deep(video),
.body :deep(iframe) {
  max-width: 320px;
  max-height: 200px;
}
.body :deep(blockquote) {
  margin: 4px 0;
  padding: 2px 8px;
  font-size: 12px;
}
.body :deep(h5) {
  margin: 6px 0 2px;
  font-size: 12px;
  font-weight: normal;
  color: var(--fp-muted);
}
.body :deep(blockquote img:not(.emoji)) {
  max-width: 80px;
  max-height: 80px;
}
.body :deep(pre) {
  max-height: 240px;
  overflow: auto;
}
.foot {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  min-height: 18px;
  font-size: 11px;
  line-height: 18px;
  color: var(--fp-muted);
}
.actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.actions > :deep(button) {
  border: 0;
  background: transparent;
  color: var(--fp-muted);
  cursor: pointer;
  font-size: 11px;
  padding: 0 4px;
  border-radius: 3px;
}
.actions > :deep(button:hover) {
  color: var(--fp-link);
}
.fp-bubble :deep(.rx) {
  margin-top: 4px;
}
.fp-bubble :deep(.rx.empty) {
  position: absolute;
  top: -10px;
  right: 6px;
  margin: 0;
}
.fp-bubble :deep(.rx.empty > .ghost) {
  padding: 0 7px;
  line-height: 16px;
  background: var(--fp-card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.is-self .fp-bubble :deep(.rx.empty) {
  right: auto;
  left: 6px;
}
@media (hover: hover) and (pointer: fine) {
  .actions {
    position: absolute;
    bottom: 2px;
    left: 100%;
    padding-left: 4px;
    white-space: nowrap;
  }
  .is-self .actions {
    left: auto;
    right: 100%;
    padding: 0 4px 0 0;
  }
  .actions,
  .fp-bubble :deep(.rx.empty:not(.open)) {
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  .fp-bubble:hover .actions,
  .fp-bubble:focus-within .actions,
  .fp-bubble:hover :deep(.rx.empty) {
    opacity: 1;
  }
}

/* 聊天室与私信共享渲染逻辑，聊天室将身份、内容及交互分层排布。 */
.fp-msg.is-room {
  gap: 12px;
  max-width: 94%;
}
.is-room .fp-avatar-frame {
  margin-top: 2px;
}
.is-room .fp-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--fp-avatar-radius);
}
.is-room .message-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  max-width: 100%;
}
.is-room.is-self .message-stack {
  align-items: flex-end;
}
.is-room .head {
  gap: 4px 8px;
  min-height: 20px;
  max-width: 100%;
}
.is-room .name {
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.is-room .name small {
  margin-left: 4px;
  font-size: 10px;
  font-weight: 400;
}
.is-room .name:hover { text-decoration: underline; text-underline-offset: 3px; }
.is-room .fp-bubble {
  padding: 10px 14px;
  max-width: 100%;
  border: 1px solid color-mix(in srgb, var(--fp-text) 5%, transparent);
  border-radius: 3px 14px 14px 14px;
}
.is-room.is-self .fp-bubble {
  border-radius: 14px 3px 14px 14px;
}
.is-room .body {
  font-size: 14px;
  line-height: 1.7;
}
.chat-quote-stack { display: grid; gap: 6px; }
.body + .chat-quote-stack { margin-top: 7px; }
.body + .chat-quote-stack :deep(.chat-quote-card) {
  background: color-mix(in srgb, var(--fp-card) 46%, transparent);
  border-color: color-mix(in srgb, var(--fp-muted) 20%, transparent);
  border-inline-start-color: color-mix(in srgb, var(--fp-muted) 50%, transparent);
}
.is-room .body :deep(p + p) { margin-top: 6px; }
.is-room .body :deep(.chat-image-frame) {
  display: inline-flex;
  align-items: flex-start;
  max-width: 100%;
  vertical-align: middle;
}
.is-room .body :deep(.chat-image-frame > picture) { display: contents; }
.blur-chat-images .body :deep(img:not(.emoji)) { filter: blur(8px); }
.is-room .body :deep(img:not(.emoji)) {
  max-width: min(180px, 100%);
  max-height: 160px;
  border-radius: 8px;
}
/* 固定上限参与气泡的固有宽度计算，窄容器再由外层 flex 缩小图片。 */
.is-room .body :deep(:where(.chat-image-frame) img:not(.emoji)) {
  min-width: 0;
  max-width: 180px;
}
.is-room .body :deep(video), .is-room .body :deep(iframe) {
  max-width: 100%;
  border-radius: 8px;
}
.is-room .body :deep(blockquote) {
  margin: 5px 0 8px;
  padding: 6px 10px;
  border-left: 2px solid color-mix(in srgb, var(--fp-muted) 35%, transparent);
  border-radius: 0 5px 5px 0;
  background: color-mix(in srgb, var(--fp-card) 45%, transparent);
  color: var(--fp-muted);
  font-size: 12px;
  line-height: 1.6;
}
.is-room .body :deep(h5) { margin: 0 0 4px; font-size: 11px; line-height: 1.6; }
.is-room .body :deep(blockquote img:not(.emoji)) { max-width: 80px; max-height: 80px; }
.is-room .body :deep(pre) {
  max-width: 100%;
  margin: 6px 0;
  padding: 10px;
  border-radius: 7px;
  font-size: 12px;
}
.fp-msg.is-room.is-standalone .fp-bubble {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.is-room.is-image .body { line-height: 0; max-width: 200px; }
.is-room.is-self.is-image .body { margin-left: auto; }
.is-room.is-image .body :deep(img:not(.emoji)) {
  display: block;
  max-width: min(200px, 100%);
  max-height: 180px;
  border-radius: 12px;
}
.is-room .foot {
  position: relative;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-height: 22px;
  max-width: 100%;
  font-size: 10px;
  line-height: 18px;
}
.is-room.is-self .foot { flex-direction: row-reverse; }
.is-room time { font-variant-numeric: tabular-nums; }
.is-room .actions, .is-room.is-self .actions {
  position: static;
  padding: 0;
  flex-wrap: wrap;
  gap: 2px;
}
.is-room .actions > :deep(button) {
  padding: 2px 5px;
  font-size: 10px;
  line-height: 16px;
  border-radius: 5px;
}
.is-room .actions > :deep(button:hover) {
  color: var(--fp-text);
  background: var(--fp-hover);
}
.is-room .message-reactions { min-width: 0; }
.is-room .message-reactions:has(.rx:empty) { display: none; }
.is-room .message-reactions :deep(.rx) { position: static; margin: 0; gap: 3px; }
.is-room .message-reactions :deep(.chip), .is-room .message-reactions :deep(.ghost) {
  padding: 1px 6px;
  line-height: 17px;
  font-size: 10px;
  background: var(--fp-card);
}
.is-room.is-self .message-reactions :deep(.panel) { left: auto; right: 0; }
.is-room .message-reactions :deep(.panel) { top: calc(100% + 4px); max-width: min(240px, calc(100vw - 80px)); }
@media (hover: hover) and (pointer: fine) {
  .is-room .actions, .is-room .message-reactions :deep(.rx.empty:not(.open)) {
    opacity: 0;
    pointer-events: none;
    transition: opacity 160ms ease;
  }
  .is-room:hover .actions, .is-room:focus-within .actions,
  .is-room:hover .message-reactions :deep(.rx.empty), .is-room:focus-within .message-reactions :deep(.rx.empty) {
    opacity: 1;
    pointer-events: auto;
  }
}
@media (max-width: 600px) {
  .fp-msg.is-room { gap: 8px; max-width: 100%; }
  .is-room .fp-avatar { width: 30px; height: 30px; }
  .is-room .fp-bubble { padding: 8px 11px; }
  .is-room .name { font-size: 11px; }
  .is-room .name small { font-size: 9px; }
  .is-room .body { font-size: 13px; }
  .is-room .foot { gap: 3px 6px; font-size: 9px; }
}
@media (prefers-reduced-motion: reduce) {
  .is-room .actions, .is-room .message-reactions :deep(.rx.empty:not(.open)) { transition: none; }
}
/* 精简模式仅改变本机显示，保留消息携带的原始外观快照。 */
.fp-msg.is-room.is-simple .fp-bubble {
  background: transparent;
  border: 0;
  box-shadow: none;
  border-radius: 0;
  padding-inline: 0;
}
.fp-msg.is-room.is-simple .fp-bubble::before,
.fp-msg.is-room.is-simple .fp-bubble::after { display: none; }
</style>
