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
    <h2>职业排行</h2>
    <p class="hint">按当前读者可见用户的经验排序，人数与名次只计算可见用户；部分用户的经验值不公开。</p>
    <p v-if="!active"><RouterLink :to="{ path: '/login', query: { redirect: '/top/profession' } }">登录</RouterLink>后可查看职业排行。</p>
    <template v-else>
      <p v-if="catalogLoading" role="status">正在读取职业目录…</p>
      <p v-if="catalogError" role="alert" class="error">{{ catalogError }}</p>
      <template v-if="catalog">
        <p v-if="catalog.pagination.total === 0">暂无已发布职业。</p>
        <div class="choices"><button v-for="job in catalog.list" :key="job.professionId" type="button" :aria-pressed="job.professionId === selected?.professionId" @click="choose(job)">{{ job.displayName }}</button></div>
        <nav v-if="catalog.pagination.pageCount > 1" aria-label="排行职业目录分页"><button :disabled="catalogLoading || catalog.pagination.p <= 1" @click="loadCatalog(catalog.pagination.p - 1)">上一页排行职业</button><span>第 {{ catalog.pagination.p }} / {{ catalog.pagination.pageCount }} 页</span><button :disabled="catalogLoading || catalog.pagination.p >= catalog.pagination.pageCount" @click="loadCatalog(catalog.pagination.p + 1)">下一页排行职业</button></nav>
      </template>
      <button type="button" class="refresh-prof-btn" :class="{ 'is-hidden': catalog && !catalogError }" :disabled="catalogLoading" @click="loadCatalog()">重新读取排行职业目录</button>
      <template v-if="selected">
        <h3>{{ selected.displayName }}</h3><p>{{ selected.description }}</p>
        <p v-if="rankingLoading" role="status">正在读取职业排行…</p><p v-if="rankingError" role="alert" class="error">{{ rankingError }}</p>
        <template v-if="ranking">
          <p>当前可见 {{ ranking.pagination.total }} 人</p><p v-if="ranking.pagination.total === 0">当前没有可见的排行用户。</p>
          <ol class="rankings">
            <li v-for="user in ranking.list" :key="user.userName">
              <span class="rank" :aria-label="`第${user.rank}名`">{{ user.rank }}</span>
              <RouterLink :to="`/member/${encodeURIComponent(user.userName)}`" class="identity">
                <img :src="avatarThumbnail(displayAvatar(user.userAvatarURL), 40)" :alt="user.userNickname || user.userName" loading="lazy" @error="fallbackAvatar" />
                <span>{{ user.userNickname || user.userName }}<small>@{{ user.userName }}</small></span>
              </RouterLink>
              <span class="level">{{ user.professionName }} · {{ user.levelName }}</span>
              <span v-if="user.totalExperience !== undefined">{{ user.totalExperience.toLocaleString() }} 经验</span><span v-else class="hint">经验未公开</span>
            </li>
          </ol>
          <nav v-if="ranking.pagination.pageCount > 1" aria-label="职业榜单分页"><button :disabled="rankingLoading || ranking.pagination.p <= 1" @click="loadRanking(ranking.pagination.p - 1)">上一页职业榜单</button><span>第 {{ ranking.pagination.p }} / {{ ranking.pagination.pageCount }} 页</span><button :disabled="rankingLoading || ranking.pagination.p >= ranking.pagination.pageCount" @click="loadRanking(ranking.pagination.p + 1)">下一页职业榜单</button></nav>
        </template>
        <button type="button" class="refresh-prof-btn" :class="{ 'is-hidden': ranking && !rankingError }" :disabled="rankingLoading" @click="loadRanking()">重新读取职业榜单</button>
        <button type="button" :aria-expanded="showGuide" @click="showGuide = !showGuide">{{ showGuide ? '收起成长提示' : '查看成长提示' }}</button>
        <ProfessionGuide v-if="showGuide" :profession-id="selected.professionId" :name="selected.displayName" />
      </template>
    </template>
  </section>
</template>

<style scoped lang="scss" src="./profession-ranking.scss"></style>
