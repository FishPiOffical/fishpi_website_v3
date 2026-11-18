<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime, timeISO } from '@/utils/time'

const props = defineProps<{ memberId: string }>()
const auth = useAuthStore()
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const dates = computed(() => {
  const owner = mounted.value && auth.isLoggedIn && auth.account?.oId === props.memberId ? auth.account : null
  return [
    { label: '注册时间', value: /^\d{13}$/.test(props.memberId) ? Number(props.memberId) : undefined },
    { label: '最后登录时间', value: owner?.userLatestLoginTime },
  ].flatMap(({ label, value }) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1e12 && value < 1e13
    ? [{ label, datetime: timeISO(value), text: formatDateTime(value).slice(0, 16) }] : [])
})
</script>

<template>
  <dl v-if="dates.length" class="member-dates" aria-label="账号时间">
    <div v-for="date in dates" :key="date.label">
      <dt>{{ date.label }}</dt>
      <dd><time :datetime="date.datetime">{{ date.text }}</time></dd>
    </div>
  </dl>
</template>

<style scoped>
.member-dates { display: flex; flex-wrap: wrap; gap: 4px 20px; margin: 0; font-size: 12px; line-height: 1.6; }
.member-dates > div { display: flex; flex-wrap: wrap; gap: 0 6px; }
.member-dates dt { color: var(--fp-muted); }
.member-dates dd { margin: 0; color: var(--fp-text); font-variant-numeric: tabular-nums; }
</style>
