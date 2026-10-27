<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { profileOperationKey } from '@/api/v3-profile'
import { preferenceFields, fetchV3Preferences, saveV3Preferences, fetchV3LocaleOptions, fetchV3SkinOptions,
  type PreferenceResource, type PreferenceValue, type PreferenceOption } from '@/api/v3-preferences'

const props = defineProps<{ resource: PreferenceResource; title: string; fields?: string[] }>()
const auth = useAuthStore(), { accessToken } = storeToRefs(auth)
const schema = computed(() => preferenceFields[props.resource].filter(field => !props.fields || props.fields.includes(field.key)))
const values = ref<Record<string, PreferenceValue>>({}), original = ref<Record<string, PreferenceValue>>({})
const options = ref<Record<string, PreferenceOption[]>>({})
const ready = ref(false), loading = ref(false), busy = ref(false), error = ref(''), message = ref('')
let mounted = false, generation = 0, intent: { fingerprint: string; key: string; fields: string[] } | null = null
function reset() { generation++; intent = null; values.value = {}; original.value = {}; options.value = {}; ready.value = loading.value = busy.value = false; error.value = message.value = '' }
async function load() {
  if (!accessToken.value) return
  const token = accessToken.value, current = ++generation
  const valid = () => mounted && token === accessToken.value && current === generation
  ready.value = false; loading.value = true; error.value = message.value = ''
  try {
    const [data, choices] = await Promise.all([
      fetchV3Preferences(props.resource),
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
  const token = accessToken.value, current = generation, fingerprint = JSON.stringify(changes)
  const valid = () => mounted && token === accessToken.value && current === generation
  busy.value = true; message.value = error.value = ''
  try {
    if (!intent || intent.fingerprint !== fingerprint) intent = { fingerprint, key: profileOperationKey(), fields: Object.keys(changes) }
    const saved = await saveV3Preferences(props.resource, changes, intent.key)
    if (valid()) { intent = null; values.value = { ...saved }; original.value = { ...saved }; message.value = '已保存'; void auth.reloadAccount().catch(() => {}) }
  } catch (failure) { if (valid()) error.value = failure instanceof Error ? failure.message : '设置保存失败' }
  finally { if (valid()) busy.value = false }
}
function setNumber(key: string, event: Event) { values.value[key] = (event.target as HTMLInputElement).valueAsNumber }
function setBoolean(key: string, event: Event) { values.value[key] = (event.target as HTMLInputElement).checked }
function setString(key: string, event: Event) { values.value[key] = (event.target as HTMLInputElement).value }
function setChoice(key: string, event: Event) { values.value[key] = Number((event.target as HTMLSelectElement).value) }
onMounted(() => { mounted = true; void load() })
watch(accessToken, () => { reset(); if (mounted) void load() }, { flush: 'sync' })
onBeforeUnmount(() => { mounted = false; reset() })
</script>

<template>
  <section class="owner-preferences">
    <h2>{{ title }}</h2>
    <p v-if="loading" role="status">正在读取设置…</p>
    <form @submit.prevent="save">
      <fieldset v-if="ready" :disabled="loading || busy">
        <label v-for="field in schema" :key="field.key" :class="{ check: field.kind === 'boolean' }">
          <template v-if="field.kind === 'boolean'"><input type="checkbox" :aria-label="field.label" :checked="values[field.key] === true" @change="setBoolean(field.key, $event)" />{{ field.label }}</template>
          <template v-else>
            {{ field.label }}
            <select v-if="options[field.key]" :aria-label="field.label" :value="values[field.key]" @change="setString(field.key, $event)">
              <option v-if="!options[field.key]?.some(option => option.value === values[field.key])" :value="String(values[field.key] ?? '')" disabled>{{ values[field.key] || '暂无选项' }}</option>
              <option v-for="option in options[field.key]" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <select v-else-if="field.kind === 'choice'" :aria-label="field.label" :value="values[field.key]" @change="setChoice(field.key, $event)"><option v-for="choice in field.choices" :key="choice.value" :value="choice.value">{{ choice.label }}</option></select>
            <input v-else-if="field.kind === 'number'" type="number" :aria-label="field.label" :value="values[field.key]" :min="field.min" :max="field.max" step="1" @input="setNumber(field.key, $event)" />
            <input v-else :aria-label="field.label" :value="values[field.key]" :maxlength="field.max" @input="setString(field.key, $event)" />
          </template>
        </label>
        <button type="submit">{{ busy ? '保存中…' : `保存${title}` }}</button>
      </fieldset>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="message" role="status">{{ message }}</p>
    <button type="button" :disabled="loading || busy" @click="load">重新读取{{ title }}</button>
  </section>
</template>

<style scoped lang="scss">
.owner-preferences { margin: 16px 0; }
h2 { font-size: 18px; margin: 0 0 12px; }
fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: 12px; }
label { display: grid; gap: 6px; }
label.check { display: flex; align-items: center; gap: 8px; }
input:not([type='checkbox']), select { box-sizing: border-box; width: 100%; padding: 9px 12px; border-radius: 8px; border: 1px solid var(--fp-border); background: var(--fp-bg); color: var(--fp-text); }
button { width: fit-content; border: 1px solid var(--fp-border); border-radius: 8px; background: transparent; color: var(--fp-text); padding: 7px 14px; cursor: pointer; margin-top: 8px; }
button:disabled { opacity: .5; cursor: default; }
.error { color: #c34a36; }
</style>
