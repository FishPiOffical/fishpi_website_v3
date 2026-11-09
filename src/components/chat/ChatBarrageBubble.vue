<script setup lang="ts">
import { avatarStyle } from '@/utils/avatar'

defineProps<{ content: string; color: string; avatar?: string; author?: string }>()
</script>

<template>
  <span class="barrage-bubble" :style="{ color }">
    <span class="barrage-avatar" :style="avatarStyle(avatar)" aria-hidden="true"></span>
    <span v-if="author" class="barrage-author">{{ author }}</span>
    <span class="barrage-text">{{ content }}</span>
  </span>
</template>

<style scoped>
.barrage-bubble {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 100%;
  box-sizing: border-box;
  padding: 5px 11px 5px 5px;
  border: 1px solid rgb(255 255 255 / 24%);
  border-radius: 999px;
  background: rgb(35 42 51 / 36%);
  font-size: 14px;
  line-height: 22px;
  text-shadow: 0 1px 3px rgb(0 0 0 / 75%);
}
.barrage-avatar {
  flex: 0 0 22px;
  height: 22px;
  border-radius: 8px;
  background: var(--fp-surface-subtle) center / cover no-repeat;
}
.barrage-author {
  font-size: 12px;
  color: #fff;
}
.barrage-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
