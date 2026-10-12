<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { nextTick, ref } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'

const chat = useChatStore()
const { discuss, sending, connected } = storeToRefs(chat)
const { isLoggedIn } = storeToRefs(useAuthStore())
const draft = ref('')
const editing = ref(false)
const input = ref<HTMLInputElement>()
const saveError = ref('')

async function edit() {
  editing.value = true
  saveError.value = ''
  draft.value = ''
  await nextTick()
  input.value?.focus()
}

async function save() {
  if (!draft.value.trim() || sending.value || !connected.value) return
  await chat.setDiscuss(draft.value.trim())
  saveError.value = chat.error
  if (!saveError.value) {
    editing.value = false
    draft.value = ''
  }
}
</script>

<template>
  <div class="topic-module">
    <p class="topic"><span aria-hidden="true">#</span> {{ discuss || '暂无话题' }}</p>
    <button v-if="isLoggedIn && !editing" class="edit" type="button" @click="edit">修改话题 <span aria-hidden="true">↗</span></button>
    <form v-if="isLoggedIn && editing" class="editor" @submit.prevent="save">
      <input ref="input" v-model="draft" aria-label="设置新话题" placeholder="聊点什么新鲜事…" :disabled="sending" @keydown.esc="editing = false" />
      <div class="actions">
        <button class="edit" type="button" :disabled="sending" @click="editing = false">取消</button>
        <button class="submit" type="submit" :disabled="!draft.trim() || sending || !connected">{{ sending ? '更新中…' : '更新话题' }}</button>
      </div>
      <p v-if="saveError" class="error" role="alert">{{ saveError }}</p>
    </form>
  </div>
</template>

<style scoped>
.topic { margin: 0; padding: 10px 12px; border-radius: 6px; background: color-mix(in srgb, var(--fp-primary) 8%, transparent); color: var(--fp-primary); font-size: 14px; font-weight: 600; line-height: 1.65; overflow-wrap: anywhere; }
.topic > span { margin-right: 3px; opacity: .65; }
.edit { padding: 0; border: 0; background: transparent; color: var(--fp-muted); font-size: 11px; cursor: pointer; }
.topic-module > .edit { display: block; margin: 8px 0 0 auto; }
.edit:hover { color: var(--fp-text); text-decoration: underline; }
.editor { margin-top: 10px; }
input { width: 100%; min-width: 0; padding: 7px 9px; border: 1px solid var(--fp-border); border-radius: 6px; background: var(--fp-bg); color: var(--fp-text); font-size: 12px; }
.actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 8px; }
.submit { padding: 5px 10px; border: 0; border-radius: 5px; background: var(--fp-primary); color: #fff; font-size: 11px; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
input:focus-visible, button:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 2px; }
.error { margin: 6px 0 0; color: var(--fp-accent); font-size: 11px; }
</style>
