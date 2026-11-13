<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { chatPetStatusLabels } from '@/api/v3-chat-messages'
import { fetchChatPetProfile, fetchRankedPet } from '@/api/v3-rankings'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'

type PetProfile = Awaited<ReturnType<typeof fetchChatPetProfile | typeof fetchRankedPet>>

const route = useRoute()
const auth = useAuthStore()
const mounted = ref(false)
const profile = ref<PetProfile>()
const status = ref<'loading' | 'unavailable' | 'error' | 'ready'>('loading')
const attempt = ref(0)
const fromChat = computed(() => route.name === 'chat-pet-profile')
const id = computed(() => fromChat.value ? route.params.messageId : route.params.petId)
const viewer = computed(() => fromChat.value && auth.accessToken ? auth.account?.oId : undefined)
const activity = computed(() => {
  const pet = profile.value
  if (!pet || !('state' in pet) || !Object.hasOwn(chatPetStatusLabels, pet.state)) return
  return chatPetStatusLabels[pet.state as keyof typeof chatPetStatusLabels]
})
const progress = computed(() => [
  { title: '学习等级', items: profile.value?.learning },
  { title: '职业等级', items: profile.value?.career },
])

usePageSeo(() => ({ title: profile.value?.name || '宠物资料', path: route.path, robots: 'noindex' }))
onMounted(() => { mounted.value = true })

watch([id, fromChat, viewer, mounted, attempt], async ([target, chat, owner, ready], _, onCleanup) => {
  profile.value = undefined
  status.value = 'loading'
  if (!ready || typeof target !== 'string' || (chat && !owner)) return

  const controller = new AbortController()
  const identity = getAuthContextVersion()
  onCleanup(() => controller.abort())
  const current = () => !controller.signal.aborted && (!chat || identity === getAuthContextVersion())

  try {
    const load = chat ? fetchChatPetProfile : fetchRankedPet
    const pet = await load(target, controller.signal)
    if (!current()) return
    profile.value = pet
    status.value = 'ready'
  } catch (error) {
    if (!current()) return
    status.value = error instanceof ApiError && [403, 404, 422].includes(error.status) ? 'unavailable' : 'error'
  }
})
</script>

<template>
  <main class="fp-page fp-ui pet-profile-page">
    <RouterLink :to="fromChat ? '/cr' : '/top/pets'">{{ fromChat ? '返回聊天室' : '返回宠物排行榜' }}</RouterLink>
    <section class="pet-profile" aria-labelledby="pet-profile-title">
      <template v-if="profile">
        <img v-if="profile.speciesId" :src="`/images/pets/${profile.speciesId}.webp`" width="144" height="144" alt="" />
        <h1 id="pet-profile-title">{{ profile.name }}</h1>
        <p class="owner">
          主人：<RouterLink :to="{ name: 'member', params: { userName: profile.user.userName } }">{{ profile.user.userNickname || profile.user.userName }}</RouterLink>
        </p>
        <dl class="pet-profile-stats">
          <div v-if="profile.level"><dt>等级</dt><dd>Lv.{{ profile.level }}</dd></div>
          <div v-if="profile.experience !== undefined"><dt>经验</dt><dd>{{ profile.experience.toLocaleString('zh-CN') }}</dd></div>
          <div v-if="activity"><dt>活动状态</dt><dd>{{ activity }}</dd></div>
        </dl>
        <p v-if="fromChat" class="snapshot-note">{{ profile.experience === undefined ? '发言时的宠物资料' : '活动状态取自发言时' }}</p>
        <section v-for="group in progress" :key="group.title" class="pet-profile-progress">
          <h2>{{ group.title }}</h2>
          <dl v-if="group.items?.length">
            <div v-for="item in group.items" :key="item.id"><dt>{{ item.name }}</dt><dd>Lv.{{ item.level }}</dd></div>
          </dl>
          <p v-else>暂无等级资料</p>
        </section>
      </template>
      <template v-else>
        <h1 id="pet-profile-title">宠物资料</h1>
        <p v-if="status === 'loading'" role="status">正在加载宠物资料…</p>
        <p v-else-if="status === 'unavailable'" role="alert">这只宠物的资料已不可查看。</p>
        <template v-else-if="status === 'error'">
          <p role="alert">宠物资料暂时无法加载。</p>
          <button type="button" class="fp-btn" @click="attempt++">重新加载</button>
        </template>
      </template>
    </section>
  </main>
</template>

<style scoped>
.pet-profile-page { max-width: 660px; }
.pet-profile {
  margin-top: 16px;
  padding: clamp(16px, 5vw, 32px);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  background: var(--fp-card);
  text-align: center;
}
.pet-profile img { display: block; object-fit: contain; margin: 0 auto 12px; }
.pet-profile h1 { margin: 0; font-size: 24px; overflow-wrap: anywhere; }
.owner, .snapshot-note { color: var(--fp-muted); }
.pet-profile-stats { display: flex; justify-content: center; gap: 24px; margin: 24px 0 16px; }
.pet-profile dt { font-size: 13px; color: var(--fp-muted); }
.pet-profile dd { margin: 4px 0 0; font-weight: 600; }
.snapshot-note { margin: 0; font-size: 12px; }
.pet-profile-progress { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--fp-border); text-align: left; }
.pet-profile-progress h2 { margin: 0 0 12px; font-size: 16px; }
.pet-profile-progress dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; margin: 0; }
.pet-profile-progress dl div { padding: 8px 10px; border-radius: 6px; background: var(--fp-bg); }
.pet-profile-progress p { color: var(--fp-muted); }
</style>
