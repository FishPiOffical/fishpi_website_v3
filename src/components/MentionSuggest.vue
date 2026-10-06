<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { searchUserNames } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [string]; pick: [name: string] }>()

const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)
const names = ref<string[]>([])
const open = ref(false)

watch(
  () => props.modelValue,
  async (text) => {
    const m = text.match(/@([a-zA-Z0-9_-]{1,20})$/)
    if (!m || !apiKey.value) {
      names.value = []
      open.value = false
      return
    }
    names.value = (await searchUserNames(apiKey.value, m[1])).slice(0, 8)
    open.value = names.value.length > 0
  },
)

function choose(name: string) {
  const next = props.modelValue.replace(/@([a-zA-Z0-9_-]{1,20})$/, `@${name} `)
  emit('update:modelValue', next)
  emit('pick', name)
  open.value = false
}
</script>

<template>
  <ul v-if="open" class="suggest">
    <li v-for="n in names" :key="n">
      <button type="button" @click="choose(n)">@{{ n }}</button>
    </li>
  </ul>
</template>

<style scoped>
.suggest {
  list-style: none;
  margin: 0;
  padding: 4px;
  position: absolute;
  bottom: 100%;
  left: 0;
  z-index: 6;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  min-width: 160px;
}
button {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  color: var(--fp-text);
  padding: 4px 8px;
  cursor: pointer;
}
</style>
