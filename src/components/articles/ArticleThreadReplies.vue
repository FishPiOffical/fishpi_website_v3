<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { ApiError } from '@/api/http'
import { readV3CommentReplies } from '@/api/v3-content'
import type { ArticleComment } from '@/api/fishpi'
import type { CommentLocation } from '@/api/v3-comment-location'

const props = defineProps<{ articleId: string; root: ArticleComment; target?: CommentLocation | null }>()
const emit = defineEmits<{ relocate: [] }>()
const region = ref<HTMLElement>()
const regionId = useId()
const expanded = ref(false)
const loading = ref(false)
const unavailable = ref(false)
const error = ref('')
const placementError = ref(false)
const result = ref<Awaited<ReturnType<typeof readV3CommentReplies>> | null>(null)
const preview = computed(() => props.root.commentThreadReplies ?? [])
const remaining = computed(() => Math.max(0, (props.root.commentThreadReplyCount ?? 0) - preview.value.length))
const shown = computed(() => unavailable.value ? [] : expanded.value && result.value ? result.value.replies : preview.value)
let request: AbortController | null = null
let requestedPage = 1
let requestedTarget: CommentLocation | undefined

async function scrollToReply(target: CommentLocation) {
  await nextTick()
  if (target !== props.target) return
  const element = document.getElementById('comment' + target.id)
  placementError.value = !(element && region.value?.contains(element))
  if (!placementError.value) element?.scrollIntoView({ block: 'center' })
}

async function load(page: number, target?: CommentLocation) {
  request?.abort()
  const controller = new AbortController()
  request = controller
  requestedPage = page
  requestedTarget = target
  expanded.value = loading.value = true
  error.value = ''
  placementError.value = false
  try {
    const data = await readV3CommentReplies(props.articleId, props.root.oId, page, controller.signal)
    if (controller.signal.aborted) return
    unavailable.value = false
    result.value = data
    if (target) await scrollToReply(target)
  } catch (reason) {
    if (controller.signal.aborted) return
    if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) {
      unavailable.value = true
      result.value = null
    }
    error.value = reason instanceof Error ? reason.message : '回复读取失败，请重试'
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
}

function collapse() {
  request?.abort()
  expanded.value = loading.value = false
  result.value = null
  error.value = ''
  placementError.value = false
}

watch(() => props.target, target => {
  placementError.value = false
  if (!target?.thread?.replyPage) return
  if (!expanded.value && preview.value.some(reply => reply.oId === target.id)) {
    void scrollToReply(target)
    return
  }
  void load(target.thread.replyPage, target)
}, { immediate: true, flush: 'post' })

watch(() => props.root, () => {
  unavailable.value = false
  if (!expanded.value) return
  const count = props.root.commentThreadReplyCount ?? 0
  if (!count) { collapse(); return }
  const target = loading.value && requestedTarget === props.target ? requestedTarget : undefined
  void load(target?.thread?.replyPage ?? Math.min(requestedPage, Math.ceil(count / 20)), target)
})
onBeforeUnmount(() => request?.abort())
</script>

<template>
  <div :id="regionId" ref="region" :aria-busy="loading">
    <slot :replies="shown" />
  </div>
  <div v-if="remaining || expanded" class="thread-tools">
    <button type="button" class="btn small" :aria-expanded="expanded" :aria-controls="regionId" @click="expanded ? collapse() : load(1)">
      {{ expanded ? '收起回复' : `展开其余 ${remaining} 条回复` }}
    </button>
    <template v-if="expanded && result && result.pagination.pageCount > 1">
      <button type="button" class="btn small" :disabled="loading || result.pagination.p <= 1" @click="load(result.pagination.p - 1)">上一页回复</button>
      <span>{{ result.pagination.p }} / {{ result.pagination.pageCount }}</span>
      <button type="button" class="btn small" :disabled="loading || result.pagination.p >= result.pagination.pageCount" @click="load(result.pagination.p + 1)">下一页回复</button>
    </template>
    <span v-if="loading" role="status">正在读取回复…</span>
  </div>
  <p v-if="placementError" class="thread-error" role="alert">
    回复位置已变化或暂不可见。
    <button type="button" class="btn small" @click="emit('relocate')">重新定位评论</button>
  </p>
  <p v-else-if="error" class="thread-error" role="alert">{{ error }} <button v-if="expanded" type="button" class="btn small" @click="load(requestedPage, requestedTarget)">重试</button></p>
</template>

<style scoped>
.thread-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; color: var(--fp-muted); font-size: 12px; }
.thread-error { color: var(--fp-danger); font-size: 12px; }
</style>
