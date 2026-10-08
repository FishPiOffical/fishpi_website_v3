<script setup lang="ts">
import { RouterLink } from 'vue-router'

withDefaults(
  defineProps<{
    userName: string
    nickname?: string
    avatar?: string
    time?: string
    html?: string
    self?: boolean
  }>(),
  { nickname: '', avatar: '', time: '', html: '', self: false },
)
</script>

<template>
  <article class="fp-msg" :class="{ 'is-self': self }">
    <RouterLink :to="`/member/${userName}`" class="fp-avatar-frame" :title="userName">
      <img class="fp-avatar" :src="avatar || '/favicon.svg'" alt="" loading="lazy" />
    </RouterLink>
    <div class="fp-bubble">
      <RouterLink :to="`/member/${userName}`" class="name">
        {{ nickname || userName }}<small v-if="nickname && nickname !== userName">({{ userName }})</small>
      </RouterLink>
      <slot>
        <div class="vditor-reset body" v-html="html" />
      </slot>
      <slot name="reactions" />
      <div class="foot">
        <span class="actions"><slot name="actions" /></span>
        <time>{{ time }}</time>
      </div>
    </div>
  </article>
</template>

<style scoped>
.fp-msg {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  max-width: 88%;
}
.fp-msg.is-self {
  margin-left: auto;
  flex-direction: row-reverse;
}
.fp-avatar-frame {
  flex: none;
}
.fp-bubble {
  position: relative;
  min-width: 0;
  padding: 6px 12px 4px;
  border-radius: 6px;
  background: var(--fp-hover);
  overflow-wrap: anywhere;
}
.is-self .fp-bubble {
  background: var(--fp-self);
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
.actions > :deep(button),
.actions :deep(.report > .ghost) {
  border: 0;
  background: transparent;
  color: var(--fp-muted);
  cursor: pointer;
  font-size: 11px;
  padding: 0 4px;
  border-radius: 3px;
}
.actions > :deep(button:hover),
.actions :deep(.report > .ghost:hover) {
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
</style>
