<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '@/api/http'
import { fetchRankedPet } from '@/api/v3-rankings'
import { usePageSeo } from '@/composables/usePageSeo'

const route = useRoute()
const mounted = ref(false)
const profile = ref<Awaited<ReturnType<typeof fetchRankedPet>>>()
const status = ref<'loading' | 'unavailable' | 'error' | 'ready'>('loading')
const attempt = ref(0)

usePageSeo(() => ({ title: profile.value?.name || '宠物资料', path: route.path, robots: 'noindex' }))
onMounted(() => { mounted.value = true })

watch([() => route.params.petId, mounted, attempt], async ([id, ready], _, onCleanup) => {
  profile.value = undefined
  status.value = 'loading'
  if (!ready || typeof id !== 'string') return
  const controller = new AbortController()
  onCleanup(() => controller.abort())

  try {
    const pet = await fetchRankedPet(id, controller.signal)
    if (controller.signal.aborted) return
    profile.value = pet
    status.value = 'ready'
  } catch (error) {
    if (controller.signal.aborted) return
    status.value = error instanceof ApiError && [403, 404, 422].includes(error.status) ? 'unavailable' : 'error'
  }
})
</script>

<template>
  <main class="fp-page fp-ui ranked-pet-page">
    <RouterLink to="/top/pets">返回宠物排行榜</RouterLink>
    <section class="ranked-pet-card" aria-labelledby="ranked-pet-title">
      <template v-if="profile">
        <img :src="`/images/pets/${profile.speciesId}.webp`" alt="" width="144" height="144" />
        <h1 id="ranked-pet-title">{{ profile.name }}</h1>
        <RouterLink :to="{ name: 'member', params: { userName: profile.user.userName } }">
          {{ profile.user.userNickname || profile.user.userName }}
        </RouterLink>
        <dl>
          <div><dt>等级</dt><dd>Lv.{{ profile.level }}</dd></div>
          <div><dt>经验</dt><dd>{{ profile.experience.toLocaleString('zh-CN') }}</dd></div>
        </dl>
      </template>
      <template v-else>
        <h1 id="ranked-pet-title">宠物资料</h1>
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
.ranked-pet-page { max-width: 660px; }
.ranked-pet-card {
  margin-top: 16px;
  padding: 32px 24px;
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  background: var(--fp-card);
  text-align: center;
}
.ranked-pet-card img { display: block; object-fit: contain; margin: 0 auto 12px; }
.ranked-pet-card h1 { margin: 0 0 8px; font-size: 24px; overflow-wrap: anywhere; }
.ranked-pet-card dl { display: flex; justify-content: center; gap: 32px; margin: 24px 0 0; }
.ranked-pet-card dt { font-size: 13px; color: var(--fp-muted); }
.ranked-pet-card dd { margin: 4px 0 0; font-weight: 600; }
</style>
