<script setup lang="ts">
import { avatarThumbnail, fallbackAvatar } from '@/utils/avatar'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { fetchV3Professions, fetchV3ProfessionRanking, type Page, type Profession, type ProfessionRank } from '@/api/v3-professions'
import { displayAvatar } from '@/api/v3-profile'
import ProfessionGuide from './ProfessionGuide.vue'
const { accessToken, account } = storeToRefs(useAuthStore())
const catalog = ref<Page<Profession> | null>(null), ranking = ref<Page<ProfessionRank> | null>(null)
const selected = ref<Profession | null>(null), showGuide = ref(false)
const catalogLoading = ref(false), rankingLoading = ref(false), catalogError = ref(''), rankingError = ref('')
const mounted = ref(false), active = computed(() => mounted.value && !!accessToken.value)
let generation = 0, catalogSequence = 0, rankingSequence = 0, catalogTargetPage = 1, rankingTargetPage = 1
function identity() { return JSON.stringify([getAuthContextVersion(), !!accessToken.value, account.value?.oId || '']) }
let boundary = identity()
function reset() { catalogTargetPage = rankingTargetPage = 1; generation++; catalogSequence++; rankingSequence++; catalog.value = ranking.value = null; selected.value = null; showGuide.value = false; catalogLoading.value = rankingLoading.value = false; catalogError.value = rankingError.value = '' }
function guard() { const owner = identity(), current = generation; return () => mounted.value && !!accessToken.value && owner === identity() && current === generation }
async function loadCatalog(p = catalogTargetPage) {
  if (!accessToken.value) return
  catalogTargetPage = p
  const valid = guard(), sequence = ++catalogSequence
  catalogLoading.value = true; catalogError.value = ''; catalog.value = null
  try {
    let value = await fetchV3Professions(p)
    if (value.pagination.pageCount > 0 && p > value.pagination.pageCount) value = await fetchV3Professions(value.pagination.pageCount)
    if (valid() && sequence === catalogSequence) { catalogTargetPage = value.pagination.p; catalog.value = value; if (!selected.value && value.list[0]) choose(value.list[0]) }
  } catch (failure) { if (valid() && sequence === catalogSequence) catalogError.value = failure instanceof Error ? failure.message : '职业目录读取失败' }
  finally { if (valid() && sequence === catalogSequence) catalogLoading.value = false }
}
function choose(job: Profession) { selected.value = { ...job }; showGuide.value = false; void loadRanking(1) }
async function loadRanking(p = rankingTargetPage) {
  if (!accessToken.value || !selected.value) return
  rankingTargetPage = p
  const id = selected.value.professionId, valid = guard(), sequence = ++rankingSequence
  rankingLoading.value = true; rankingError.value = ''; ranking.value = null
  try {
    let value = await fetchV3ProfessionRanking(id, p)
    if (value.pagination.pageCount > 0 && p > value.pagination.pageCount) value = await fetchV3ProfessionRanking(id, value.pagination.pageCount)
    if (valid() && sequence === rankingSequence && id === selected.value?.professionId) { rankingTargetPage = value.pagination.p; ranking.value = value }
  } catch (failure) { if (valid() && sequence === rankingSequence) rankingError.value = failure instanceof Error ? failure.message : '职业排行读取失败' }
  finally { if (valid() && sequence === rankingSequence) rankingLoading.value = false }
}
onMounted(() => { mounted.value = true; void loadCatalog(1) })
watch([accessToken, () => account.value?.oId], () => {
  const current = identity()
  if (current !== boundary) {
    boundary = current; reset()
    if (mounted.value) void loadCatalog(1)
  } else if (mounted.value && accessToken.value) {
    void loadCatalog(catalogTargetPage)
    if (selected.value) void loadRanking(rankingTargetPage)
  }
}, { flush: 'sync' })
onBeforeUnmount(() => { mounted.value = false; reset() })
</script>

<template>
  <section class="profession-ranking">
    <header class="ranking-head">
      <div>
        <p class="eyebrow">社区成长</p>
        <h1>职业排行</h1>
        <p class="intro">看看大家在各自擅长的领域，走到了哪一步。</p>
      </div>
      <RouterLink v-if="active" to="/settings/profession" class="my-professions">我的职业 <span aria-hidden="true">↗</span></RouterLink>
    </header>
    <p v-if="!active" class="empty-state"><RouterLink :to="{ path: '/login', query: { redirect: '/top/profession' } }">登录</RouterLink>后可查看职业排行。</p>
    <template v-else>
      <div class="catalog-section">
        <div class="section-label">
          <span>选择职业</span>
          <button v-if="!catalog || catalogError" type="button" class="icon-button" :disabled="catalogLoading" @click="loadCatalog()" title="重新读取职业目录" aria-label="重新读取职业目录">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg>
          </button>
        </div>
        <p v-if="catalogLoading" role="status" class="state-line">正在读取职业目录…</p>
        <p v-if="catalogError" role="alert" class="error">{{ catalogError }}</p>
        <template v-if="catalog">
          <p v-if="catalog.pagination.total === 0" class="empty-state">暂无已发布职业。</p>
          <div class="choices" aria-label="排行职业">
            <button v-for="job in catalog.list" :key="job.professionId" type="button" :aria-pressed="job.professionId === selected?.professionId" @click="choose(job)">
              <span>{{ job.displayName }}</span><span v-if="job.professionId === selected?.professionId" class="choice-check" aria-hidden="true">✓</span>
            </button>
          </div>
          <nav v-if="catalog.pagination.pageCount > 1" aria-label="排行职业目录分页"><button :disabled="catalogLoading || catalog.pagination.p <= 1" @click="loadCatalog(catalog.pagination.p - 1)" aria-label="上一页排行职业">上一页</button><span>{{ catalog.pagination.p }} / {{ catalog.pagination.pageCount }}</span><button :disabled="catalogLoading || catalog.pagination.p >= catalog.pagination.pageCount" @click="loadCatalog(catalog.pagination.p + 1)" aria-label="下一页排行职业">下一页</button></nav>
        </template>
      </div>
      <template v-if="selected">
        <div class="profession-summary">
          <div class="profession-copy">
            <h2>{{ selected.displayName }}</h2>
            <p v-if="selected.description">{{ selected.description }}</p>
          </div>
          <button type="button" class="guide-button" :aria-expanded="showGuide" @click="showGuide = !showGuide">{{ showGuide ? '收起成长提示' : '成长提示' }}<span aria-hidden="true">{{ showGuide ? '−' : '+' }}</span></button>
        </div>
        <ProfessionGuide v-if="showGuide" :profession-id="selected.professionId" :name="selected.displayName" />
        <div class="list-head">
          <span>职业榜单 <small v-if="ranking">{{ ranking.pagination.total.toLocaleString() }} 人可见</small></span>
          <button v-if="!ranking || rankingError" type="button" class="icon-button" :disabled="rankingLoading" @click="loadRanking()" title="重新读取职业榜单" aria-label="重新读取职业榜单">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg>
          </button>
        </div>
        <p v-if="rankingLoading" role="status" class="state-line">正在读取职业排行…</p><p v-if="rankingError" role="alert" class="error">{{ rankingError }}</p>
        <template v-if="ranking">
          <p v-if="ranking.pagination.total === 0" class="empty-state">当前没有可见的排行用户。</p>
          <div v-if="ranking.list.length" class="table-head" aria-hidden="true"><span>排名</span><span>用户</span><span>职业等级</span><span>累计经验</span></div>
          <ol class="rankings">
            <li v-for="user in ranking.list" :key="user.userName">
              <span class="rank" :class="{ 'is-leading': user.rank <= 3 }" :aria-label="`第${user.rank}名`">{{ user.rank }}</span>
              <RouterLink :to="`/member/${encodeURIComponent(user.userName)}`" class="identity">
                <img :src="avatarThumbnail(displayAvatar(user.userAvatarURL), 40)" :alt="user.userNickname || user.userName" loading="lazy" @error="fallbackAvatar" />
                <span class="identity-copy"><strong>{{ user.userNickname || user.userName }}</strong><small>@{{ user.userName }}</small></span>
              </RouterLink>
              <span class="level"><strong>{{ user.levelName }}</strong><small>{{ user.professionName }}</small></span>
              <span v-if="user.totalExperience !== undefined" class="experience"><strong>{{ user.totalExperience.toLocaleString() }}</strong><small>经验</small></span><span v-else class="experience is-private">经验未公开</span>
            </li>
          </ol>
          <nav v-if="ranking.pagination.pageCount > 1" aria-label="职业榜单分页"><button :disabled="rankingLoading || ranking.pagination.p <= 1" @click="loadRanking(ranking.pagination.p - 1)" aria-label="上一页职业榜单">上一页</button><span>{{ ranking.pagination.p }} / {{ ranking.pagination.pageCount }}</span><button :disabled="rankingLoading || ranking.pagination.p >= ranking.pagination.pageCount" @click="loadRanking(ranking.pagination.p + 1)" aria-label="下一页职业榜单">下一页</button></nav>
        </template>
        <p class="visibility-note">仅统计当前可见的职业记录，部分用户的经验值未公开。</p>
      </template>
    </template>
  </section>
</template>

<style scoped lang="scss" src="./profession-ranking.scss"></style>
