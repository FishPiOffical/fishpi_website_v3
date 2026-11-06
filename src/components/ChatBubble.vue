<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import ImageLightbox from '@/components/ImageLightbox.vue'
import MedalList from '@/components/medal/MedalList.vue'
import VipNickname from '@/components/user/VipNickname.vue'
import { DEFAULT_AVATAR } from '@/utils/avatar'
import { isSingleImageMessage } from '@/utils/chatMessage'

const props = withDefaults(
  defineProps<{
    userId?: string
    userName: string
    nickname?: string
    avatar?: string
    time?: string
    html?: string
    self?: boolean
    medals?: unknown
    vipNickname?: boolean
    chatroom?: boolean
    /** 红包由调用方明确标记，图片则根据完整消息内容判断。 */
    standalone?: boolean
  }>(),
  { userId: '', nickname: '', avatar: '', time: '', html: '', self: false, medals: undefined, vipNickname: false, chatroom: false, standalone: false },
)

const zoomed = ref('')
const singleImage = computed(() => props.chatroom && isSingleImageMessage(props.html))
const isStandalone = computed(() => props.chatroom && (props.standalone || singleImage.value))

function onAvatarError(e: Event) {
  const img = e.target as HTMLImageElement
  if (img.getAttribute('src') !== DEFAULT_AVATAR) img.src = DEFAULT_AVATAR
}

function onBodyClick(e: MouseEvent) {
  const img = (e.target as HTMLElement | null)?.closest('img')
  if (!img || img.classList.contains('emoji') || !img.closest('.vditor-reset')) return
  e.preventDefault()
  zoomed.value = img.currentSrc || img.src
}
</script>

<template>
  <article class="fp-msg" :class="{ 'is-self': self, 'is-room': chatroom, 'is-standalone': isStandalone, 'is-image': singleImage }">
    <RouterLink :to="`/member/${userName}`" class="fp-avatar-frame" :data-user-card="userName" :title="userName" :aria-label="`查看 ${nickname || userName} 的主页`">
      <img class="fp-avatar" :src="avatar || DEFAULT_AVATAR" alt="" loading="lazy" @error="onAvatarError" />
    </RouterLink>
    <div class="message-stack">
      <div v-if="chatroom" class="head">
        <RouterLink :to="`/member/${userName}`" class="name">
          <VipNickname v-if="vipNickname" :user-id="userId" :user-name="userName">
            {{ nickname || userName }}
          </VipNickname>
          <template v-else>{{ nickname || userName }}</template>
          <small v-if="nickname && nickname !== userName">({{ userName }})</small>
        </RouterLink>
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
          <div class="vditor-reset body" v-html="html" />
        </slot>
        <template v-if="!chatroom">
          <slot name="reactions" />
          <div class="foot">
            <span class="actions"><slot name="actions" /></span>
            <time>{{ time }}</time>
          </div>
        </template>
      </div>
      <div v-if="chatroom" class="foot">
        <time>{{ time }}</time>
        <div v-if="$slots.reactions" class="message-reactions"><slot name="reactions" /></div>
        <span v-if="$slots.actions" class="actions"><slot name="actions" /></span>
      </div>
    </div>
    <ImageLightbox v-model="zoomed" />
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
  display: block;
  font-size: 12px;
  line-height: 18px;
  color: var(--fp-muted);
  text-decoration: none;
}
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
  border-radius: 10px;
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
.is-room .body :deep(p + p) { margin-top: 6px; }
.is-room .body :deep(img:not(.emoji)) {
  max-width: min(220px, 100%);
  max-height: 260px;
  border-radius: 8px;
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
.is-room.is-image .body { line-height: 0; }
.is-room.is-image .body :deep(img:not(.emoji)) {
  display: block;
  max-width: min(280px, 100%);
  max-height: 320px;
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
  .is-room .fp-avatar { width: 30px; height: 30px; border-radius: 8px; }
  .is-room .fp-bubble { padding: 8px 11px; }
  .is-room .name { font-size: 11px; }
  .is-room .name small { font-size: 9px; }
  .is-room .body { font-size: 13px; }
  .is-room .foot { gap: 3px 6px; font-size: 9px; }
}
@media (prefers-reduced-motion: reduce) {
  .is-room .actions, .is-room .message-reactions :deep(.rx.empty:not(.open)) { transition: none; }
}
</style>
