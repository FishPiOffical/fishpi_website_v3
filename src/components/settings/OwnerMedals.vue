<script setup lang="ts">
import { formatDate } from '@/utils/time'

import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { profileOperationKey } from '@/api/v3-profile'
import { fetchV3OwnerMedals, setV3MedalDisplayed, moveV3Medal, type OwnerMedal } from '@/api/v3-medals'
import MedalIcon from '@/components/medal/MedalIcon.vue'

type Operation = { id: string; name: string; key: string } & ({ kind: 'display'; displayed: boolean } | { kind: 'move'; direction: 'up' | 'down' })
const { accessToken, account } = storeToRefs(useAuthStore())
const medals = ref<OwnerMedal[]>([]), page = ref(1), total = ref(0), pageCount = ref(0)
const loading = ref(false), busy = ref(false), ready = ref(false), readError = ref(''), error = ref(''), message = ref('')
const pending = ref<Operation | null>(null)
let mounted = false, generation = 0, readSequence = 0
function identity() { return JSON.stringify([getAuthContextVersion(), !!accessToken.value, account.value?.oId || '']) }
let boundary = identity()
function reset() { generation++; readSequence++; medals.value = []; page.value = 1; total.value = pageCount.value = 0; pending.value = null; ready.value = loading.value = busy.value = false; readError.value = error.value = message.value = '' }
async function load(target = page.value) {
  if (!accessToken.value) return
  const owner = identity(), current = generation, sequence = ++readSequence
  const valid = () => mounted && owner === identity() && current === generation && sequence === readSequence
  loading.value = true; ready.value = false; medals.value = []; readError.value = ''
  try {
    let result = await fetchV3OwnerMedals(target)
    // Another session may have removed/expired the final page. Read the actual last page.
    if (result.pagination.pageCount > 0 && target > result.pagination.pageCount) result = await fetchV3OwnerMedals(result.pagination.pageCount)
    if (valid()) { medals.value = result.list; page.value = result.pagination.p; total.value = result.pagination.total; pageCount.value = result.pagination.pageCount; ready.value = true }
  } catch (failure) { if (valid()) { total.value = pageCount.value = 0; readError.value = failure instanceof Error ? failure.message : '勋章读取失败' } }
  finally { if (valid()) loading.value = false }
}
async function execute(operation: Operation) {
  if (busy.value || !accessToken.value) return
  const owner = identity(), current = generation
  const valid = () => mounted && owner === identity() && current === generation
  pending.value = operation; busy.value = true; error.value = message.value = ''
  try {
    if (operation.kind === 'display') await setV3MedalDisplayed(operation.id, operation.displayed, operation.key)
    else await moveV3Medal(operation.id, operation.direction, operation.key)
    if (valid()) {
      pending.value = null; message.value = operation.kind === 'display' ? '展示状态已保存' : '移动已完成'
      await load()
    }
  } catch (failure) {
    if (valid()) {
      error.value = failure instanceof Error ? failure.message : '勋章操作失败'
      // Definitive client rejections have no successful mutation to recover. Unknown outcomes keep the exact command/key.
      if (failure instanceof ApiError && failure.status >= 400 && failure.status < 500) pending.value = null
    }
  } finally { if (valid()) busy.value = false }
}
function display(medal: OwnerMedal) { if (ready.value && !loading.value && !busy.value && !pending.value) void execute({ id: medal.id, name: medal.name, kind: 'display', displayed: !medal.displayed, key: profileOperationKey() }) }
function move(medal: OwnerMedal, direction: 'up' | 'down') { if (ready.value && !loading.value && !busy.value && !pending.value) void execute({ id: medal.id, name: medal.name, kind: 'move', direction, key: profileOperationKey() }) }
function retry() { if (pending.value && !loading.value) void execute(pending.value) }
function expires(value: number) { return value <= 0 ? '永久' : formatDate(value) }
onMounted(() => { mounted = true; void load(1) })
watch([accessToken, () => account.value?.oId], () => {
  const current = identity()
  if (current === boundary) return
  boundary = current; reset()
  if (mounted) { void load(1) }
}, { flush: 'sync' })
onBeforeUnmount(() => { mounted = false; reset() })
</script>

<template>
  <section class="owner-medals">
    <h2>你的勋章</h2>
    <p class="hint">包含当前有效的隐藏勋章。上移、下移按全部持有记录相邻移动，隐藏和已过期记录也参与顺序。</p>
    <p v-if="loading" role="status">正在读取勋章…</p>
    <p v-if="readError" role="alert" class="error">{{ readError }}</p>
    <p v-if="ready && total === 0" class="hint">暂无有效勋章。</p>
    <ul v-if="ready && medals.length" class="medals">
      <li v-for="medal in medals" :key="medal.id">
        <div class="info">
          <MedalIcon owner :medal="{ id: medal.id, name: medal.name, type: medal.type, description: medal.description }" :tooltip="false" />
          <strong>{{ medal.name }}</strong>
          <span v-if="medal.type">{{ medal.type }}</span>
          <span v-if="medal.description">{{ medal.description }}</span>
          <span class="hint">{{ medal.displayed ? '展示中' : '已隐藏' }} · 到期：{{ expires(medal.expiresAt) }}</span>
        </div>
        <div class="actions">
          <button class="fp-control" type="button" :aria-label="`上移${medal.name}`" :disabled="loading || busy || !!pending" @click="move(medal, 'up')">上移</button>
          <button class="fp-control" type="button" :aria-label="`下移${medal.name}`" :disabled="loading || busy || !!pending" @click="move(medal, 'down')">下移</button>
          <button class="fp-control" type="button" :aria-label="`${medal.displayed ? '隐藏' : '展示'}${medal.name}`" :disabled="loading || busy || !!pending" @click="display(medal)">{{ medal.displayed ? '隐藏' : '展示' }}</button>
        </div>
      </li>
    </ul>
    <nav v-if="ready && pageCount > 1" aria-label="本人勋章分页">
      <button class="fp-control" type="button" :disabled="page <= 1 || busy || loading" @click="load(page - 1)">上一页勋章</button>
      <span>第 {{ page }} / {{ pageCount }} 页，共 {{ total }} 枚</span>
      <button class="fp-control" type="button" :disabled="page >= pageCount || busy || loading" @click="load(page + 1)">下一页勋章</button>
    </nav>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="message" role="status">{{ message }}</p>
    <p v-if="pending && !busy" class="hint">“{{ pending.name }}”的操作结果尚未确认，重试会恢复同一次操作。</p>
    <button class="fp-control" v-if="pending" type="button" :disabled="busy || loading" @click="retry">重试未确认的勋章操作</button>
    <button class="fp-control settings-refresh" type="button" :disabled="busy || loading" @click="load()" title="刷新"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg><span class="settings-visually-hidden">重新读取勋章</span></button>
  </section>
</template>

<style scoped lang="scss" src="./owner-medals.scss"></style>
