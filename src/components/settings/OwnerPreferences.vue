<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { useFunctionPreferencesStore } from '@/stores/functionPreferences'
import { useAuthStore } from '@/stores/auth'
import { profileOperationKey } from '@/api/v3-profile'
import { preferenceFields, fetchV3Preferences, saveV3Preferences, fetchV3LocaleOptions, fetchV3SkinOptions,
  type PreferenceResource, type PreferenceValue, type PreferenceOption } from '@/api/v3-preferences'

const props = defineProps<{ resource: PreferenceResource; title: string; fields?: string[] }>()
const auth = useAuthStore(), { accessToken, account } = storeToRefs(auth)
const functionPreferences = useFunctionPreferencesStore()
const schema = computed(() => preferenceFields[props.resource].filter(field => !props.fields || props.fields.includes(field.key)))
function sectionFor(field: (typeof schema.value)[number]) {
  if (props.resource === 'functions') return field.kind === 'boolean' ? '互动与快捷操作' : '列表与首页'
  if (props.resource === 'privacy') {
    if (['articles', 'comments', 'breezemoons', 'points'].includes(field.key)) return '内容与记录'
    if (field.key.startsWith('follow') || field.key === 'watchingArticles') return '关注与收藏'
    return '在线与排行'
  }
  return ''
}
const sections = computed(() => {
  const groups = new Map<string, typeof schema.value>()
  for (const field of schema.value) {
    const title = sectionFor(field)
    if (!groups.has(title)) groups.set(title, [])
    groups.get(title)!.push(field)
  }
  return [...groups].map(([title, fields]) => ({ title, fields }))
})
const values = ref<Record<string, PreferenceValue>>({}), original = ref<Record<string, PreferenceValue>>({})
const options = ref<Record<string, PreferenceOption[]>>({})
const ready = ref(false), loading = ref(false), busy = ref(false), error = ref(''), message = ref('')
let mounted = false, generation = 0, intent: { fingerprint: string; key: string; fields: string[] } | null = null
function identity() { return JSON.stringify([getAuthContextVersion(), !!accessToken.value, account.value?.oId || '']) }
let boundary = identity()
function reset() { generation++; intent = null; values.value = {}; original.value = {}; options.value = {}; ready.value = loading.value = busy.value = false; error.value = message.value = '' }
async function load() {
  if (!accessToken.value) return
  const owner = identity(), current = ++generation
  const valid = () => mounted && owner === identity() && current === generation
  ready.value = false; loading.value = true; error.value = message.value = ''
  try {
    const [data, choices] = await Promise.all([
      props.resource === 'functions' ? functionPreferences.load(true) : fetchV3Preferences(props.resource),
      props.resource === 'locale' ? fetchV3LocaleOptions() : props.resource === 'display' && schema.value.some(field => field.key === 'skin' || field.key === 'mobileSkin') ? fetchV3SkinOptions() : Promise.resolve({}),
    ])
    if (valid()) { values.value = { ...data }; original.value = { ...data }; options.value = choices; ready.value = true }
  } catch (failure) { if (valid()) { values.value = {}; original.value = {}; error.value = failure instanceof Error ? failure.message : '设置读取失败' } }
  finally { if (valid()) loading.value = false }
}
async function save() {
  if (!ready.value || loading.value || busy.value || !accessToken.value) return
  const changes: Record<string, PreferenceValue> = {}
  for (const field of schema.value) {
    const value = typeof values.value[field.key] === 'string' ? (values.value[field.key] as string).trim() : values.value[field.key]!
    if (value !== original.value[field.key] || intent?.fields.includes(field.key)) changes[field.key] = value
  }
  if (!Object.keys(changes).length) { message.value = '没有需要保存的更改'; error.value = ''; return }
  const owner = identity(), current = generation, fingerprint = JSON.stringify(changes)
  const valid = () => mounted && owner === identity() && current === generation
  busy.value = true; message.value = error.value = ''
  try {
    if (!intent || intent.fingerprint !== fingerprint) intent = { fingerprint, key: profileOperationKey(), fields: Object.keys(changes) }
    const saved = await saveV3Preferences(props.resource, changes, intent.key)
    if (valid()) { if (props.resource === 'functions') functionPreferences.accept(saved); intent = null; values.value = { ...saved }; original.value = { ...saved }; message.value = '已保存'; void auth.reloadAccount().catch(() => {}) }
  } catch (failure) { if (valid()) error.value = failure instanceof Error ? failure.message : '设置保存失败' }
  finally { if (valid()) busy.value = false }
}
function setNumber(key: string, event: Event) { values.value[key] = (event.target as HTMLInputElement).valueAsNumber }
function setBoolean(key: string, event: Event) { values.value[key] = (event.target as HTMLInputElement).checked }
function setString(key: string, event: Event) { values.value[key] = (event.target as HTMLInputElement).value }
function setChoice(key: string, event: Event) { values.value[key] = Number((event.target as HTMLSelectElement).value) }
onMounted(() => { mounted = true; void load() })
watch([accessToken, () => account.value?.oId], () => {
  const current = identity()
  if (current === boundary) return
  boundary = current; reset()
  if (mounted) { void load() }
}, { flush: 'sync' })
onBeforeUnmount(() => { mounted = false; reset() })
</script>

<template>
  <section class="owner-preferences">
    <header class="settings-section-head"><h2>{{ title }}</h2><button class="fp-control settings-refresh" type="button" :disabled="loading || busy" @click="load" title="刷新"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg><span class="settings-visually-hidden">重新读取{{ title }}</span></button></header>
    <p v-if="loading" role="status">正在读取设置…</p>
    <form v-if="ready" class="preferences-form" :aria-label="title" @submit.prevent="save">
      <fieldset v-for="section in sections" :key="section.title" :disabled="loading || busy">
        <legend :class="section.title ? 'group-title' : 'settings-visually-hidden'">{{ section.title || title }}</legend>
        <div class="preference-fields">
          <label v-for="field in section.fields" :key="field.key" :class="{ check: field.kind === 'boolean', 'full-field': field.key === 'indexRedirectURL' }">
            <template v-if="field.kind === 'boolean'">
              <span>{{ field.label }}</span>
              <input type="checkbox" :checked="values[field.key] === true" @change="setBoolean(field.key, $event)" />
            </template>
            <template v-else>
              <span>{{ field.label }}</span>
              <select v-if="options[field.key]" class="fp-control" :value="values[field.key]" @change="setString(field.key, $event)">
                <option v-if="!options[field.key]?.some(option => option.value === values[field.key])" :value="String(values[field.key] ?? '')" disabled>{{ values[field.key] || '暂无选项' }}</option>
                <option v-for="option in options[field.key]" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <select v-else-if="field.kind === 'choice'" class="fp-control" :value="values[field.key]" @change="setChoice(field.key, $event)">
                <option v-for="choice in field.choices" :key="choice.value" :value="choice.value">{{ choice.label }}</option>
              </select>
              <input v-else-if="field.kind === 'number'" class="fp-control" type="number" :value="values[field.key]" :min="field.min" :max="field.max" step="1" @input="setNumber(field.key, $event)" />
              <input v-else class="fp-control" :value="values[field.key]" :maxlength="field.max" @input="setString(field.key, $event)" />
            </template>
          </label>
        </div>
      </fieldset>
      <footer class="preferences-actions">
        <button data-tone="primary" class="fp-control" type="submit" :disabled="loading || busy">{{ busy ? '保存中…' : `保存${title}` }}</button>
      </footer>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="message" role="status">{{ message }}</p>

  </section>
</template>

<style scoped>
.owner-preferences {
  container-type: inline-size;
}
.owner-preferences .preferences-form {
  gap: 20px;
}
.group-title {
  padding: 0;
  margin-block-end: 8px;
  font-size: 13px;
  color: var(--fp-title);
}
.preference-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px 20px;
  grid-column: 1 / -1;
}
.full-field, .preference-fields > :only-child {
  grid-column: 1 / -1;
}
.preference-fields .fp-control {
  block-size: max(40px, 2.5em);
}
.preference-fields:has(> .check) {
  row-gap: 0;
}
.owner-preferences .preference-fields label.check {
  justify-content: space-between;
  padding: 8px 0;
  min-height: 44px;
  box-sizing: border-box;
  border: 0;
  border-block-end: 1px solid var(--fp-divider);
  border-radius: 0;
  background: transparent;
  font-weight: 400;
}
.preference-fields label.check input {
  margin: 0;
}
.preferences-actions {
  display: flex;
  justify-content: flex-end;
  border-block-start: 1px solid var(--fp-divider);
  padding-block-start: 14px;
}
.preferences-form .preferences-actions > button[type=submit] {
  margin: 0;
}
@container (min-width: 35rem) {
  .preference-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .owner-preferences .preference-fields {
    grid-template-columns: minmax(0, 1fr);
  }
  .preferences-actions > button {
    flex: 1;
  }
  .owner-preferences .preference-fields label.check {
    min-height: 48px;
  }
}
</style>
