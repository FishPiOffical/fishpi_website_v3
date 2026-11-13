<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { chatPetStatusLabels } from '@/api/v3-chat-messages'
import { fetchChatPetProfile, fetchRankedPet } from '@/api/v3-rankings'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'
import PetIcon from '@/components/pets/PetIcon.vue'

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
  { title: '学习等级', icon: 'course' as const, items: profile.value?.learning },
  { title: '职业等级', icon: 'work' as const, items: profile.value?.career },
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
    <RouterLink class="profile-back" :to="fromChat ? '/cr' : '/top/pets'">
      <PetIcon name="chevron" />
      {{ fromChat ? '返回聊天室' : '返回宠物排行榜' }}
    </RouterLink>

    <template v-if="profile">
      <section class="pet-profile" :data-species="profile.speciesId" aria-labelledby="pet-profile-title">
        <div v-if="profile.speciesId" class="pet-portrait">
          <img :src="`/images/pets/${profile.speciesId}.webp`" width="180" height="180" alt="" />
        </div>
        <div class="pet-profile-body">
          <h1 id="pet-profile-title">{{ profile.name }}</h1>
          <p class="owner">
            主人 <RouterLink :to="{ name: 'member', params: { userName: profile.user.userName } }">{{ profile.user.userNickname || profile.user.userName }}</RouterLink>
          </p>
          <dl v-if="profile.level || profile.experience !== undefined || activity" class="pet-profile-stats">
            <div v-if="profile.level"><dt>等级</dt><dd>Lv.{{ profile.level }}</dd></div>
            <div v-if="profile.experience !== undefined"><dt>经验</dt><dd>{{ profile.experience.toLocaleString('zh-CN') }}</dd></div>
            <div v-if="activity"><dt>活动状态</dt><dd>{{ activity }}</dd></div>
          </dl>
          <p v-if="profile.archived" class="snapshot-note">已归档 · 成长等级保留至重新领养前{{ fromChat && activity ? ' · 活动状态取自发言时' : '' }}</p>
          <p v-else-if="fromChat" class="snapshot-note">{{ profile.experience === undefined ? '发言时的宠物资料' : '活动状态取自发言时' }}</p>
        </div>
      </section>

      <div class="pet-profile-growth">
        <section v-for="group in progress" :key="group.title" class="pet-profile-progress">
          <h2><span class="progress-icon"><PetIcon :name="group.icon" /></span>{{ group.title }}</h2>
          <dl v-if="group.items?.length">
            <div v-for="item in group.items" :key="item.id">
              <dt>{{ item.name }}</dt>
              <dd>Lv.{{ item.level }}</dd>
            </div>
          </dl>
          <p v-else>暂无等级资料</p>
        </section>
      </div>
    </template>

    <section v-else class="pet-profile profile-placeholder" aria-labelledby="pet-profile-title">
      <h1 id="pet-profile-title">宠物资料</h1>
      <p v-if="status === 'loading'" role="status">正在加载宠物资料…</p>
      <p v-else-if="status === 'unavailable'" role="alert">这只宠物的资料已不可查看。</p>
      <template v-else-if="status === 'error'">
        <p role="alert">宠物资料暂时无法加载。</p>
        <button type="button" class="fp-btn" @click="attempt++">重新加载</button>
      </template>
    </section>
  </main>
</template>

<style scoped>
.pet-profile-page {
  width: min(100% - 32px, 820px);
  margin-inline: auto;
}

.profile-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  margin-bottom: 12px;
  color: var(--fp-muted);
  font-size: 13px;
}

.profile-back svg {
  width: 14px;
  height: 14px;
  transform: rotate(180deg);
}

.pet-profile,
.pet-profile-progress {
  border: 1px solid var(--fp-border);
  border-radius: 14px;
  background: var(--fp-card);
}

.pet-profile {
  --pet-accent: #639371;
  display: flex;
  align-items: center;
  gap: clamp(20px, 5vw, 44px);
  padding: clamp(20px, 4vw, 32px);
}

.pet-profile[data-species="momota"] { --pet-accent: #b47a52; }
.pet-profile[data-species="hexiaotun"] { --pet-accent: #719447; }
.pet-profile[data-species="yubingmiao"] { --pet-accent: #d78942; }
.pet-profile[data-species="paixiaoyu"] { --pet-accent: #598cad; }

.pet-portrait {
  display: grid;
  flex: 0 0 clamp(144px, 27vw, 216px);
  place-items: center;
  aspect-ratio: 1;
  border-radius: 12px;
  background: radial-gradient(circle at 48% 45%,
    color-mix(in srgb, var(--pet-accent) 19%, var(--fp-card)),
    color-mix(in srgb, var(--pet-accent) 7%, var(--fp-card)));
}

.pet-portrait img {
  display: block;
  width: 85%;
  height: auto;
  object-fit: contain;
}

.pet-profile-body { flex: 1; min-width: 0; }

.pet-profile h1 {
  margin: 0;
  color: var(--fp-title);
  font-size: clamp(24px, 4vw, 34px);
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.owner, .snapshot-note { color: var(--fp-muted); }
.owner { margin: 8px 0 0; font-size: 14px; overflow-wrap: anywhere; }
.owner a { margin-inline-start: 4px; color: var(--fp-link); font-weight: 600; }

.pet-profile-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 0;
  margin: 20px 0 0;
  padding-top: 16px;
  border-top: 1px solid var(--fp-divider);
}

.pet-profile-stats > div {
  flex: 1 1 auto;
  min-width: 76px;
  padding-inline: 12px;
  border-inline-start: 1px solid var(--fp-divider);
}

.pet-profile-stats > div:first-child { padding-inline-start: 0; border-inline-start: 0; }
.pet-profile-stats dt { color: var(--fp-muted); font-size: 12px; }
.pet-profile-stats dd { margin: 3px 0 0; font-size: 19px; font-weight: 700; font-variant-numeric: tabular-nums; }
.snapshot-note { margin: 10px 0 0; font-size: 12px; }

.pet-profile-growth {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 16px;
  margin-top: 16px;
}

.pet-profile-progress { padding: 18px 20px; }

.pet-profile-progress h2 {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 10px;
  font-size: 16px;
  color: var(--fp-title);
}

.progress-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  color: var(--fp-link);
  background: color-mix(in srgb, var(--fp-link) 10%, var(--fp-card));
}

.pet-profile-progress + .pet-profile-progress .progress-icon {
  color: var(--fp-accent);
  background: var(--fp-accent-soft);
}

.progress-icon svg { width: 16px; height: 16px; }
.pet-profile-progress dl { margin: 0; }

.pet-profile-progress dl > div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--fp-divider);
}

.pet-profile-progress dl > div:last-child { border-bottom: 0; padding-bottom: 0; }
.pet-profile-progress dt { font-size: 14px; }
.pet-profile-progress dd { margin: 0; flex-shrink: 0; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.pet-profile-progress p { margin: 0; color: var(--fp-muted); }
.profile-placeholder { display: block; }
.profile-placeholder p { color: var(--fp-muted); }

@media (max-width: 560px) {
  .pet-profile { flex-direction: column; align-items: stretch; gap: 16px; }
  .pet-portrait { flex: none; aspect-ratio: auto; min-height: 130px; }
  .pet-portrait img { width: 126px; }
  .pet-profile-growth { grid-template-columns: minmax(0, 1fr); gap: 12px; }
}
</style>
