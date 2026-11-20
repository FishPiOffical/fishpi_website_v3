<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { fetchV3CardBackground, profileOperationKey, saveV3CardBackground } from '@/api/v3-profile'
import { uploadV3Files } from '@/api/v3-uploads'
import { useAuthStore } from '@/stores/auth'
import { formatUploadLimit, imageUploadAccept, validateEditorFile } from '@/utils/editorUpload'
import { memberSnapshotKey, removePublicSnapshot } from '@/utils/publicSnapshots'

const MAX_BACKGROUND_UPLOAD_BYTES = 2 * 1024 * 1024
const backgroundUploadLimit = formatUploadLimit(MAX_BACKGROUND_UPLOAD_BYTES)

const auth = useAuthStore()
const saved = ref<string | null>(null)
const draft = ref('')
const loading = ref(false), saving = ref(false), error = ref(''), message = ref('')
const uploadStatus = ref('')
const previewFailed = ref(false)
const picker = ref<HTMLInputElement>()
const operation = ref<{ value: string; key: string }>()
const busy = computed(() => loading.value || saving.value || Boolean(uploadStatus.value))
const preview = computed(() => {
  if (!draft.value) return ''
  try {
    const url = new URL(draft.value, import.meta.env.VITE_BROWSER_API_ORIGIN || 'https://fishpi.cn')
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch { return '' }
})
let version = 0, readRequest: AbortController | undefined, uploadRequest: AbortController | undefined
let mounted = false
const identity = () => JSON.stringify([getAuthContextVersion(), auth.isLoggedIn, auth.account?.oId])
const errorText = (reason: unknown) => reason instanceof Error ? reason.message : '卡片背景操作失败'
watch(draft, () => { previewFailed.value = false }, { flush: 'sync' })

async function read() {
  if (!auth.isLoggedIn) return
  const owner = identity(), run = ++version, controller = new AbortController()
  readRequest?.abort()
  readRequest = controller
  loading.value = true
  error.value = ''
  try {
    const value = await fetchV3CardBackground(controller.signal)
    if (owner === identity() && run === version) saved.value = draft.value = value
  } catch {
    if (owner === identity() && run === version) error.value = '读取卡片背景失败，请重试'
  } finally {
    if (run === version) loading.value = false
  }
}

async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || busy.value || operation.value || saved.value === null || !auth.isLoggedIn) return
  error.value = message.value = ''
  if (file.size > MAX_BACKGROUND_UPLOAD_BYTES) {
    error.value = `背景图片不能超过 ${backgroundUploadLimit}，请选择更小的图片`
    return
  }
  const owner = identity(), run = version, controller = new AbortController()
  const valid = () => run === version && owner === identity() && !controller.signal.aborted
  uploadRequest = controller
  uploadStatus.value = '正在检查图片…'
  try {
    const image = await validateEditorFile(file, controller.signal, true)
    if (!valid()) return
    uploadStatus.value = '正在上传图片…'
    const [result] = await uploadV3Files([image], controller.signal, percent => {
      if (valid()) uploadStatus.value = percent === null ? '正在上传图片…' : percent === 100 ? '正在处理图片…' : `正在上传图片 ${percent}%`
    })
    if (!valid()) return
    if (!result?.url) throw new Error(result?.maxBytes ? `图片最大可上传 ${formatUploadLimit(result.maxBytes)}` : result?.failureMessage || '图片上传失败，请重试')
    draft.value = result.url
  } catch (reason) {
    if (valid()) error.value = errorText(reason)
  } finally {
    if (valid()) uploadStatus.value = ''
  }
}

async function persist(value: string) {
  if (saved.value === null || busy.value || !auth.isLoggedIn) return
  const retry = Boolean(operation.value)
  const command = operation.value ??= { value, key: profileOperationKey() }
  const owner = identity(), run = version
  saving.value = true
  error.value = message.value = ''
  try {
    await saveV3CardBackground(command.value, command.key)
    if (owner !== identity() || run !== version) return
    operation.value = undefined
    if (auth.account?.userName) removePublicSnapshot(memberSnapshotKey(auth.account.userName))
    saved.value = null
    message.value = value ? '已保存卡片背景' : '已恢复默认背景'
    await read()
  } catch (reason) {
    if (owner === identity() && run === version) {
      if (!retry && reason instanceof ApiError && [400, 403, 404, 422, 429].includes(reason.status)) operation.value = undefined
      error.value = errorText(reason)
    }
  } finally {
    if (mounted && owner === identity()) saving.value = false
  }
}

function reset() {
  version++
  readRequest?.abort()
  uploadRequest?.abort()
  operation.value = undefined
  saved.value = null
  draft.value = error.value = message.value = uploadStatus.value = ''
  loading.value = saving.value = false
}
onMounted(() => { mounted = true; void read() })
watch(identity, () => { reset(); if (mounted && auth.isLoggedIn) void read() })
onBeforeUnmount(() => { mounted = false; reset() })
</script>

<template>
  <section class="fp-card background-settings" aria-label="个人卡片背景">
    <h2>个人卡片背景</h2>
    <p v-if="loading" role="status">正在读取卡片背景…</p>
    <template v-if="saved !== null">
      <figure v-if="preview && !previewFailed" class="background-preview">
        <img :key="preview" :src="preview" alt="卡片背景预览" referrerpolicy="no-referrer" @error="previewFailed = true">
      </figure>
      <p v-else class="background-preview">{{ draft ? '背景图片暂时无法预览' : '当前使用默认背景' }}</p>
      <div class="background-actions">
        <input ref="picker" type="file" hidden :accept="imageUploadAccept" @change="upload">
        <button type="button" class="fp-control" :disabled="busy || Boolean(operation)" @click="picker?.click()">上传图片</button>
        <button type="button" class="fp-control" :disabled="busy || Boolean(operation) || draft === saved" @click="persist(draft)">保存背景</button>
        <button type="button" class="fp-control" :disabled="busy || Boolean(operation) || !saved" @click="persist('')">恢复默认</button>
        <button v-if="operation && !saving" type="button" class="fp-control" @click="persist(operation.value)">重试上次保存</button>
      </div>
    </template>
    <p v-if="uploadStatus || saving && !loading" role="status">{{ uploadStatus || '正在保存背景…' }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="message" role="status">{{ message }}</p>
    <button v-if="saved === null && !loading" type="button" class="fp-control" @click="read">重读背景</button>
  </section>
</template>

<style scoped>
.background-settings { padding: var(--fp-panel-padding, 20px); }
.background-settings h2 { margin: 0 0 12px; color: var(--fp-title); font-size: 15px; }
.background-preview { display: grid; place-items: center; aspect-ratio: 3 / 1; max-width: 420px; margin: 0; overflow: hidden; border-radius: 8px; background: var(--fp-surface-subtle); color: var(--fp-muted); font-size: 13px; }
.background-preview img { width: 100%; height: 100%; object-fit: cover; min-height: 0; }
.background-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
</style>
