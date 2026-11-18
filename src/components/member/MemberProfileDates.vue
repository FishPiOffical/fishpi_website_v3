<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { formatDate, formatDateTime, timeISO } from '@/utils/time'

const props = defineProps<{ memberId: string }>()
const auth = useAuthStore()
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const dates = computed(() => {
  const owner = mounted.value && auth.isLoggedIn && auth.account?.oId === props.memberId ? auth.account : null
  return [
    { label: '注册时间', value: /^\d{13}$/.test(props.memberId) ? Number(props.memberId) : undefined, format: formatDate },
    { label: '最后登录时间', value: owner?.userLatestLoginTime, format: (value: number) => formatDateTime(value).slice(0, 16) },
  ].flatMap(({ label, value, format }) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1e12 && value < 1e13
    ? [{ label, datetime: timeISO(value), text: format(value) }] : [])
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
.member-dates { display: grid; gap: 5px; margin: 0 0 12px; padding: 8px 10px; border-radius: 7px; background: var(--fp-surface-subtle); font-size: 12px; line-height: 1.6; text-align: left; }
.member-dates > div { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0 8px; }
.member-dates dt { color: var(--fp-muted); }
.member-dates dd { margin: 0; color: var(--fp-text); font-variant-numeric: tabular-nums; }
</style>
