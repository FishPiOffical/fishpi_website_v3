<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/api/http'
import { fetchV3PublicProfessions, type PublicProfessionProfile, type PublicJob } from '@/api/v3-profession-public'
const props = defineProps<{ userName: string }>()
const { accessToken } = storeToRefs(useAuthStore())
const profile = ref<PublicProfessionProfile | null>(null), loading = ref(false), unavailable = ref(false), error = ref('')
let mounted = false, generation = 0
const jobs = computed(() => [profile.value?.primaryProfession, ...(profile.value?.professions || [])].filter((value): value is PublicJob => !!value))
function name(id: string) { return jobs.value.find(value => value.professionId === id)?.displayName || `职业编号 ${id}` }
function date(value: number) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '时间异常' : d.toLocaleString() }
function reset() { generation++; profile.value = null; unavailable.value = false; error.value = ''; loading.value = false }
async function load() {
  const token = accessToken.value, target = props.userName, current = ++generation
  const valid = () => mounted && token === accessToken.value && target === props.userName && current === generation
  profile.value = null; unavailable.value = false; error.value = ''; loading.value = true
  try { const value = await fetchV3PublicProfessions(target); if (valid()) profile.value = value }
  catch (failure) { if (valid()) { if (failure instanceof ApiError && failure.status === 404) unavailable.value = true; else error.value = failure instanceof Error ? failure.message : '公开职业资料读取失败' } }
  finally { if (valid()) loading.value = false }
}
onMounted(() => { mounted = true; void load() })
watch([accessToken, () => props.userName], () => { reset(); if (mounted) void load() }, { flush: 'sync' })
onBeforeUnmount(() => { mounted = false; reset() })
const rewardStatus = { PENDING: '待发放', GRANTED: '已发放', REVOKED: '已撤销' }
</script>

<template>
  <section class="public-professions" aria-label="公开职业资料">
    <h2>职业资料</h2>
    <p class="hint">仅展示当前可见资料；未显示的模块不代表没有记录。完整本人资料请前往职业设置。</p>
    <p v-if="loading" role="status">正在读取职业资料…</p><p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="unavailable">当前没有可展示的职业资料。</p>
    <template v-if="profile">
      <section v-if="profile.primaryProfession" aria-label="公开主职业">
        <h3>主职业</h3><h4>{{ profile.primaryProfession.displayName }}</h4><p>{{ profile.primaryProfession.description }}</p>
        <p v-if="profile.primaryProfession.state === 'SELECTED'">已选择，尚无经验进度。</p>
        <template v-else>
          <p>{{ profile.primaryProfession.levelName }}<span v-if="profile.primaryProfession.state === 'RETIRED'"> · 已停用</span></p>
          <p v-if="profile.primaryProfession.totalExperience !== undefined">累计经验 {{ profile.primaryProfession.totalExperience }} · 本级门槛 {{ profile.primaryProfession.requiredExperience }}</p>
          <p v-if="profile.primaryProfession.rarity">可见榜第 {{ profile.primaryProfession.rarity.rank }} / {{ profile.primaryProfession.rarity.totalUsers }} 名，超过 {{ profile.primaryProfession.rarity.surpassedPercent.toFixed(2) }}% 的可见用户</p>
        </template>
      </section>
      <section v-if="profile.professions !== undefined" aria-label="公开职业进度">
        <h3>职业进度</h3><p v-if="!profile.professions.length">暂无可展示的职业进度。</p>
        <ul><li v-for="job in profile.professions" :key="job.professionId"><strong>{{ job.displayName }}</strong><p>{{ job.description }}</p><template v-if="job.state !== 'SELECTED'"><span>{{ job.levelName }}{{ job.state === 'RETIRED' ? ' · 已停用' : '' }}</span><p v-if="job.totalExperience !== undefined">累计经验 {{ job.totalExperience }} · 本级门槛 {{ job.requiredExperience }}</p><p v-if="job.rarity">可见榜第 {{ job.rarity.rank }} / {{ job.rarity.totalUsers }} 名，超过 {{ job.rarity.surpassedPercent.toFixed(2) }}% 的可见用户</p></template></li></ul>
      </section>
      <section v-if="profile.majorContributions !== undefined" aria-label="公开主要贡献">
        <h3>主要贡献</h3><p v-if="!profile.majorContributions.length">暂无可展示的贡献。</p><ul><li v-for="(item, index) in profile.majorContributions" :key="index">{{ name(item.professionId) }} · {{ item.actionCode }} · {{ item.eventCount }} 次<span v-if="item.experienceSum !== undefined"> · {{ item.experienceSum }} 经验</span><span>最近 {{ date(item.lastOccurredAt) }}</span></li></ul>
      </section>
      <section v-if="profile.contributionStats !== undefined" aria-label="公开贡献统计">
        <h3>贡献统计</h3><p v-if="!profile.contributionStats.length">暂无可展示的统计。</p><ul><li v-for="item in profile.contributionStats" :key="item.professionId">{{ name(item.professionId) }} · {{ item.eventCount }} 次<span v-if="item.experienceSum !== undefined"> · {{ item.experienceSum }} 经验</span><span>最近 {{ date(item.lastOccurredAt) }}</span></li></ul>
      </section>
      <section v-if="profile.activityFeed !== undefined" aria-label="公开职业动态">
        <h3>近90天职业动态</h3><p class="hint">仅显示当前可读的公开来源概要，最多30条。</p><p v-if="!profile.activityFeed.length">暂无可展示的动态。</p><ul><li v-for="(item, index) in profile.activityFeed" :key="index">{{ name(item.professionId) }} · {{ item.actionCode }}<span v-if="item.experienceDelta !== undefined"> · {{ item.experienceDelta > 0 ? '+' : '' }}{{ item.experienceDelta }} 经验</span><span>{{ date(item.occurredAt) }}</span></li></ul>
      </section>
      <section v-if="profile.levelHistory !== undefined" aria-label="公开职业等级变化">
        <h3>近90天等级变化</h3><p v-if="!profile.levelHistory.length">暂无可展示的等级变化。</p><ul><li v-for="(item, index) in profile.levelHistory" :key="index">{{ name(item.professionId) }} · {{ item.beforeLevelCode }} → {{ item.afterLevelCode }}<span>{{ date(item.occurredAt) }}</span></li></ul>
      </section>
      <section v-if="profile.rewards !== undefined" aria-label="公开职业奖励">
        <h3>奖励概要</h3><p v-if="!profile.rewards.length">暂无可展示的奖励。</p><ul><li v-for="(item, index) in profile.rewards" :key="index">{{ name(item.professionId) }} · {{ item.levelCode }} · {{ item.rewardType === 'POINT' ? '积分奖励' : '勋章奖励' }} · {{ rewardStatus[item.status] }}<span>奖励编号 {{ item.rewardCode }}{{ item.grantedAt > 0 ? ` · ${date(item.grantedAt)}` : '' }}</span></li></ul>
      </section>
      <section v-if="profile.ranking !== undefined" aria-label="公开职业名次">
        <h3>可见榜名次</h3><p v-if="!profile.ranking.length">当前无可展示的名次。</p><ul><li v-for="item in profile.ranking" :key="item.professionId">{{ name(item.professionId) }} · 第 {{ item.rank }} / {{ item.totalUsers }} 名<span>超过 {{ item.surpassedPercent.toFixed(2) }}% 的可见用户</span></li></ul>
      </section>
    </template>
    <button type="button" :disabled="loading" @click="load">重新读取公开职业资料</button>
  </section>
</template>

<style scoped lang="scss">
.public-professions { padding: 16px 18px; } section > section { padding: 12px 0; border-top: 1px solid var(--fp-border); } h2 { margin: 0 0 12px; font-size: 20px; } h3 { margin: 0 0 10px; font-size: 17px; } h4 { margin: 8px 0; } li { margin: 12px 0; overflow-wrap: anywhere; } li > span:last-child { display: block; } ul { padding-left: 22px; }
button { border: 1px solid var(--fp-border); border-radius: 8px; color: var(--fp-text); background: transparent; padding: 7px 12px; cursor: pointer; } button:disabled { opacity: .5; cursor: default; }.hint { color: var(--fp-muted); font-size: 13px; } .error { color: #c34a36; }
@media(max-width: 640px) { .public-professions { padding: 14px; } }
</style>
