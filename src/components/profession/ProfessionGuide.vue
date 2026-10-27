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
    <template v-if="guide">
      <h4>成长来源</h4>
      <ul v-if="guide.triggers.length"><li v-for="(trigger, index) in guide.triggers" :key="index">{{ professionTriggers[trigger.triggerType] }}</li></ul>
      <p v-else>暂无已发布的成长来源。</p>
      <h4>等级奖励概要</h4>
      <ul v-if="guide.rewards.length"><li v-for="(reward, index) in guide.rewards" :key="index">{{ reward.rewardType === 'POINT' ? `${reward.amount} 积分` : '勋章奖励' }}</li></ul>
      <p v-else>暂无等级奖励概要。</p>
      <p class="hint">这里只说明成长来源与奖励类型，不保证每次操作都会增加经验或发放奖励。</p>
    </template>
    <button type="button" :disabled="loading || !accessToken" @click="load">重新读取成长提示</button>
  </section>
</template>

<style scoped lang="scss">
.profession-guide { scroll-margin-top: 88px; margin: 20px 0; border-top: 1px solid var(--fp-border); padding-top: 12px; }
h3 { font-size: 17px; } h4 { font-size: 15px; margin: 14px 0 8px; } li { margin: 8px 0; }
button { border: 1px solid var(--fp-border); color: var(--fp-text); background: transparent; border-radius: 8px; padding: 7px 12px; cursor: pointer; } button:disabled { opacity: .5; cursor: default; }
.hint { color: var(--fp-muted); font-size: 13px; } .error { color: #c34a36; }
</style>
