<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { chatMessageDetail, chatPetStatusLabels, type ChatMessage } from '@/api/v3-chat-messages'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()
const mounted = ref(false)
const message = ref<ChatMessage>()
const loading = ref(false)
const error = ref('')
const attempt = ref(0)

onMounted(() => { mounted.value = true })
watch(
  [() => route.params.messageId, mounted, () => auth.account?.oId, () => !!auth.accessToken, attempt],
  async ([id, ready, owner, authenticated], _, onCleanup) => {
    message.value = undefined
    error.value = ''
    loading.value = false
    if (!ready || !owner || !authenticated || typeof id !== 'string') return

    const controller = new AbortController()
    const identity = getAuthContextVersion()
    onCleanup(() => controller.abort())
    const current = () => !controller.signal.aborted && identity === getAuthContextVersion() &&
      auth.account?.oId === owner && route.params.messageId === id

    loading.value = true
    try {
      const detail = await chatMessageDetail(id, controller.signal)
      if (!current()) return
      if (detail.petStatus) message.value = detail
      else error.value = '这条消息的宠物资料已不可查看。'
    } catch (cause) {
      if (!current()) return
      error.value = cause instanceof ApiError && [403, 404, 422].includes(cause.status)
        ? '这条消息的宠物资料已不可查看。'
        : '宠物资料暂时无法加载。'
    } finally {
      if (current()) loading.value = false
    }
  },
)
</script>

<template>
  <main class="fp-page fp-ui pet-profile-page">
    <RouterLink :to="{ name: 'chatroom' }">返回聊天室</RouterLink>
    <section class="pet-profile" aria-labelledby="pet-profile-title">
      <template v-if="message?.petStatus">
        <img v-if="message.petStatus.speciesId" :src="`/images/pets/${message.petStatus.speciesId}.webp`"
          width="144" height="144" alt="" />
        <h1 id="pet-profile-title">{{ message.petStatus.name }}</h1>
        <p class="owner">{{ message.author.userNickname || message.author.userName }} 的宠物</p>
        <dl>
          <div v-if="message.petStatus.level"><dt>等级</dt><dd>Lv.{{ message.petStatus.level }}</dd></div>
          <div><dt>活动状态</dt><dd>{{ chatPetStatusLabels[message.petStatus.state] }}</dd></div>
        </dl>
        <p class="snapshot-note">发言时的宠物资料</p>
      </template>
      <template v-else>
        <h1 id="pet-profile-title">宠物资料</h1>
        <p v-if="loading" role="status">正在加载宠物资料…</p>
        <template v-else-if="error">
          <p role="alert">{{ error }}</p>
          <button v-if="error === '宠物资料暂时无法加载。'" type="button" @click="attempt++">重新加载</button>
        </template>
      </template>
    </section>
  </main>
</template>

<style scoped>
.pet-profile-page { max-width: 660px; }
.pet-profile {
  margin-top: 16px;
  padding: 32px 24px;
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  background: var(--fp-card);
  text-align: center;
}
.pet-profile img { display: block; object-fit: contain; margin: 0 auto 12px; }
.pet-profile h1 { margin: 0; font-size: 24px; }
.owner, .snapshot-note { color: var(--fp-muted); }
.pet-profile dl { display: flex; justify-content: center; gap: 24px; margin: 24px 0 16px; }
.pet-profile dt { font-size: 13px; color: var(--fp-muted); }
.pet-profile dd { margin: 4px 0 0; font-weight: 600; }
.snapshot-note { margin: 0; font-size: 12px; }
</style>
