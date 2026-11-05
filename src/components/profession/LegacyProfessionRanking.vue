<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { fetchLegacyProfessionRanking, type LegacyProfessionRanking } from '@/api/legacy/profession-ranking'
import type { Profession } from '@/api/v3-professions'
const auth = useAuthStore(), value = ref<LegacyProfessionRanking | null>(null), loading = ref(false), error = ref('')
const catalog = ref<Profession[]>([])
const target = ref(''), mounted = ref(false), active = computed(() => mounted.value && !!auth.apiKey && !!auth.account?.oId)
let sequence = 0
function clear(clearCatalog = true) { if (clearCatalog) catalog.value = []; sequence++; value.value = null; loading.value = false; error.value = '' }
async function read(id = target.value) {
  if (!active.value || import.meta.env.SSR) return
  clear(false); target.value = id
  const run = sequence, key = auth.apiKey, actor = auth.account?.oId, context = getAuthContextVersion()
  const valid = () => active.value && run === sequence && id === target.value && key === auth.apiKey && actor === auth.account?.oId && context === getAuthContextVersion()
  loading.value = true
  try { const result = await fetchLegacyProfessionRanking(id); if (valid()) { value.value = result; catalog.value = result.professions } }
  catch (failure) { if (valid()) error.value = failure instanceof Error ? failure.message : '职业排行读取失败' }
  finally { if (valid()) loading.value = false }
}
function choose(job: Profession) { void read(job.professionId) }
onMounted(() => { mounted.value = true; void read() })
watch([() => auth.apiKey, () => auth.account?.oId], () => { clear(); target.value = ''; void read() }, { flush: 'sync' })
onScopeDispose(() => { mounted.value = false; clear() })
</script>
<template>
  <section class="profession-ranking">
    <h2>职业排行</h2>
    <p class="hint">展示经验排行前20名中对当前账号可见的用户。名次保留原始排序，可能不连续；列表不代表完整榜单或可见总人数。</p>
    <p v-if="!active"><RouterLink :to="{path:'/login',query:{redirect:'/top/profession'}}">登录</RouterLink>后可查看职业排行。</p>
    <template v-else>
      <p v-if="loading" role="status">正在读取职业排行…</p>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <button type="button" :disabled="loading" @click="read()">重新读取职业榜单</button>
      <div class="choices" aria-label="选择排行职业" :aria-busy="loading"><button v-for="job in catalog" :key="job.professionId" type="button" :aria-pressed="job.professionId === (target || value?.selected.professionId)" @click="choose(job)">{{ job.displayName }}</button></div>
      <template v-if="value">
        <h3>{{ value.selected.displayName }}</h3><p>{{ value.selected.description }}</p>
        <p>本次可见条目 {{ value.entries.length }} 条</p><p v-if="!value.entries.length">本次排行范围内没有可见用户。</p>
        <ol class="rankings"><li v-for="user in value.entries" :key="user.userName">
          <span class="rank" :aria-label="`第${user.rank}名`">{{ user.rank }}</span>
          <RouterLink :to="`/member/${encodeURIComponent(user.userName)}`" class="identity"><img :src="user.userAvatarURL || '/images/user-thumbnail.png'" :alt="user.userNickname || user.userName" loading="lazy" /><span>{{ user.userNickname || user.userName }}<small>@{{ user.userName }}</small></span></RouterLink>
          <span class="level">{{ user.professionName }} · {{ user.levelName }}</span><span v-if="user.totalExperience !== undefined">{{ user.totalExperience.toLocaleString() }} 经验</span><span v-else class="hint">经验未公开</span>
        </li></ol>
      </template>
    </template>
  </section>
</template>
<style scoped lang="scss" src="./profession-ranking.scss"></style>
