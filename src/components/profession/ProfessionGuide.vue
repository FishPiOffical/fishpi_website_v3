<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { fetchV3ProfessionGuide, professionTriggers, type ProfessionGuide } from '@/api/v3-professions'
const props = defineProps<{ professionId: string; name: string }>()
const { accessToken } = storeToRefs(useAuthStore())
const panel = ref<HTMLElement | null>(null)
const guide = ref<ProfessionGuide | null>(null), loading = ref(false), error = ref('')
let mounted = false, generation = 0
function reset() { generation++; guide.value = null; error.value = ''; loading.value = false }
async function load() {
  if (!accessToken.value || !props.professionId) return
  const token = accessToken.value, id = props.professionId, current = ++generation
  const valid = () => mounted && token === accessToken.value && id === props.professionId && current === generation
  loading.value = true; error.value = ''; guide.value = null
  try { const value = await fetchV3ProfessionGuide(id); if (valid()) guide.value = value }
  catch (failure) { if (valid()) error.value = failure instanceof Error ? failure.message : '成长提示读取失败' }
  finally { if (valid()) loading.value = false }
}
function focusPanel() { void nextTick(() => { if (mounted) { panel.value?.focus({ preventScroll: true }); panel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } }) }
onMounted(() => { mounted = true; void load(); focusPanel() })
watch([accessToken, () => props.professionId], ([, id], [, oldId]) => { reset(); if (mounted) { void load(); if (id !== oldId) focusPanel() } }, { flush: 'sync' })
onBeforeUnmount(() => { mounted = false; reset() })
</script>

<template>
  <section ref="panel" tabindex="-1" class="profession-guide" aria-label="职业成长提示">
    <h3>{{ name }}成长提示</h3>
    <p v-if="loading" role="status">正在读取成长提示…</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <div v-if="guide" class="guide-content">
      <div class="guide-column">
      <h4>成长来源</h4>
      <ul v-if="guide.triggers.length"><li v-for="(trigger, index) in guide.triggers" :key="index">{{ professionTriggers[trigger.triggerType] }}</li></ul>
      <p v-else>暂无已发布的成长来源。</p>
      </div><div class="guide-column">
      <h4>等级奖励概要</h4>
      <ul v-if="guide.rewards.length"><li v-for="(reward, index) in guide.rewards" :key="index">{{ reward.rewardType === 'POINT' ? `${reward.amount} 积分` : '勋章奖励' }}</li></ul>
      <p v-else>暂无等级奖励概要。</p>
      </div>
      <p class="hint">这里只说明成长来源与奖励类型，不保证每次操作都会增加经验或发放奖励。</p>
    </div>
    <button type="button" class="refresh-guide-btn fp-control" :class="{ 'is-hidden': guide && !error }" :disabled="loading || !accessToken" @click="load" title="刷新成长指南" aria-label="重新读取成长提示"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg></button>
  </section>
</template>

<style scoped lang="scss">
.profession-guide { scroll-margin-top: 88px; margin: 20px 0 0; padding: 20px; border: 1px solid var(--fp-border); background: var(--fp-surface-subtle); border-radius: 10px; }
.profession-guide:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
.profession-guide h3 { margin: 0 0 18px; font-size: 15px; color: var(--fp-title); }
.guide-content { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 28px; }
.guide-column { min-width: 0; }
.profession-guide h4 { margin: 0 0 10px; font-size: 12px; color: var(--fp-muted); font-weight: 500; }
.profession-guide ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.profession-guide li { margin: 0; padding: 5px 9px; border: 1px solid var(--fp-border); border-radius: 6px; font-size: 12px; background: var(--fp-card); }
.profession-guide .hint { grid-column: 1 / -1; color: var(--fp-muted); font-size: 12px; line-height: 1.8; margin: 0; }
.profession-guide button.refresh-guide-btn { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; padding: 8px; border: 1px solid var(--fp-border); border-radius: 8px; color: var(--fp-text); background: var(--fp-card); cursor: pointer; }
.refresh-guide-btn svg { width: 18px; height: 18px; }
.profession-guide button.refresh-guide-btn.is-hidden { display: none; }
button:disabled { opacity: .5; cursor: default; }
.error { color: var(--fp-danger); }
@media (max-width: 640px) { .guide-content { grid-template-columns: minmax(0, 1fr); } }
</style>
