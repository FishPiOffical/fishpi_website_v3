<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useLegacyGameSavesStore } from '@/stores/legacyGameSaves'
import { getAuthContextVersion } from '@/api/http'
import { gameSaveData } from '@/api/v3-game-saves'
import { fpConfirm } from '@/composables/useDialog'
const auth = useAuthStore(), store = useLegacyGameSavesStore(), draft = ref(''), confirming = ref(false), error = ref(''), mounted = ref(false)
const blocked = computed(() => store.busy || !!store.pending || confirming.value), bytes = computed(() => store.current === null ? null : new TextEncoder().encode(store.current).length)
let confirmation: AbortController | null = null
const identity = () => JSON.stringify([getAuthContextVersion(), auth.apiKey, auth.account?.oId])
function cancel() { confirmation?.abort(); confirmation = null; confirming.value = false }
async function confirm(message: string) {
  const owner = identity(), controller = new AbortController(); confirmation = controller; confirming.value = true
  try { return await fpConfirm({ title: '确认旧云存档操作', message, confirmText: '确认继续', signal: controller.signal }) && !controller.signal.aborted && mounted.value && owner === identity() }
  finally { if (confirmation === controller) { confirmation = null; confirming.value = false } }
}
async function loadDraft() {
  if (blocked.value || store.current === null) return
  const raw = store.current, original = draft.value
  if (original && !await confirm('将当前云存档替换编辑框的全部内容，是否继续？')) return
  if (mounted.value && store.current === raw && draft.value === original) draft.value = raw
}
async function save() {
  if (blocked.value || store.loading || store.current === null || !mounted.value) return
  let raw: string
  error.value = ''
  try { raw = gameSaveData(draft.value) } catch (failure) { error.value = failure instanceof Error ? failure.message : '存档不合法'; return }
  if (await confirm(`保存编辑框完整原文${raw === '' ? '（空字符串）' : ''}，会覆盖当前Evolve旧云存档。旧接口没有版本冲突检测或幂等恢复，其他设备的较新存档也可能被覆盖，请先备份。是否继续？`)) await store.save(raw)
}
watch(identity, () => { cancel(); draft.value = ''; error.value = ''; if (mounted.value) void store.load() }, { flush: 'sync' })
onMounted(() => { mounted.value = true; void store.load() })
onScopeDispose(() => { mounted.value = false; cancel(); draft.value = '' })
</script>
<template>
  <div class="game-saves"><h2>游戏云存档</h2><p>Evolve旧云存档，仅读写当前账号。旧接口没有版本号、更新时间或服务端校验和，保存会覆盖原文。</p><button type="button" :disabled="store.loading || store.busy || confirming" @click="store.load">重新读取云存档</button><p v-if="store.loading" role="status">正在读取存档…</p><p v-if="store.readError" role="alert">{{ store.completed ? '保存请求已确认，但当前存档读取失败；请只重读，不要重复覆盖。' : '' }}{{ store.readError }}</p>
    <template v-if="store.current !== null"><p>本次读取 {{ bytes }} 字节（本机按UTF-8计算）</p><p v-if="store.current === ''">旧接口返回空字符串，可能无存档、存档为空或上游读取失败，不能据此确认存档不存在。</p><button type="button" :disabled="blocked" @click="loadDraft">载入当前存档到编辑框</button><label>已读取云存档原文<textarea :value="store.current" aria-label="已读取云存档原文" rows="5" readonly spellcheck="false" /></label></template>
    <label>Evolve存档编辑框<textarea v-model="draft" aria-label="Evolve存档编辑框" rows="8" maxlength="500000" :disabled="blocked" autocomplete="off" spellcheck="false" /></label><p>本页最多500000个UTF-16单位、UTF-8最多2MiB。读取与保存不会自动替换或清空编辑框。</p><button type="button" :disabled="blocked || store.loading || store.current === null" @click="save">确认覆盖旧云存档</button><p v-if="error || store.error" role="alert">{{ error || store.error }}</p><p v-if="store.pending" role="status">保存结果未确认，已锁定覆盖操作，请先读取当前云存档核对；刷新或退出会丢失本机锁定。</p><p v-if="store.completed" role="status">本次保存请求已确认，当前内容以重新读取为准。</p></div>
</template>
<style scoped lang="scss" src="./game-saves.scss"></style>
