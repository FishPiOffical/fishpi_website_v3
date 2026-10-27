<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { fetchGameSaveOptions, fetchGameSave, gameSaveData, type GameSave, type GameSaveOption } from '@/api/v3-game-saves'
import { useAuthStore } from '@/stores/auth'
import { useV3GameSavesStore } from '@/stores/v3GameSaves'
import { fpConfirm } from '@/composables/useDialog'
const auth = useAuthStore(), writes = useV3GameSavesStore(), options = ref<GameSaveOption[] | null>(null), current = ref<GameSave | null>(null)
const loading = ref(false), error = ref(''), state = ref<'idle'|'ready'|'missing'|'stale'|'error'>('idle'), draft = ref(''), confirming = ref(false)
const blocked = computed(() => loading.value || confirming.value || writes.busy || !!writes.pending)
let mounted = false, sequence = 0, generation = 0, boundary = getAuthContextVersion(), owner = auth.account?.oId, confirmation: AbortController | null = null
function stopConfirmation() { confirmation?.abort(); confirmation = null; confirming.value = false }
function clearRead() { sequence++; current.value = null; loading.value = false; error.value = ''; state.value = 'idle' }
function valid(g: number) { return mounted && g === generation && boundary === getAuthContextVersion() && !!auth.accessToken && owner === auth.account?.oId }
async function read() {
  if (!valid(generation)) return
  clearRead(); const run = sequence, g = generation, token = auth.accessToken; loading.value = true
  const active = () => valid(g) && run === sequence && token === auth.accessToken
  try {
    const directory = await fetchGameSaveOptions(); if (!active()) return; options.value = directory
    try { const result = await fetchGameSave(); if (active()) { current.value = result; state.value = 'ready' } }
    catch (e) { if (active()) { if (e instanceof ApiError && e.status === 404) state.value = 'missing'; else throw e } }
  } catch (e) { if (active()) { error.value = e instanceof Error ? e.message : '存档读取失败'; state.value = 'error' } }
  finally { if (active()) loading.value = false }
}
async function confirm(message: string, label: string) {
  const g = generation, controller = new AbortController(); confirmation = controller; confirming.value = true
  try { return await fpConfirm({ title: label, message, confirmText: label, signal: controller.signal }) && valid(g) && !controller.signal.aborted }
  finally { if (confirmation === controller) { confirmation = null; confirming.value = false } }
}
async function loadDraft() {
  if (blocked.value || !current.value) return
  const saved = current.value, g = generation
  if (draft.value && !await confirm('将用当前云存档替换编辑框内容。是否继续？', '载入云存档')) return
  if (valid(g) && current.value === saved) draft.value = saved.data
}
async function save() {
  if (blocked.value || !options.value || !['ready','missing'].includes(state.value)) return
  let raw: string; try { raw = gameSaveData(draft.value) } catch (e) { error.value = e instanceof Error ? e.message : '存档不合法'; return }
  const revision = current.value?.revision ?? 0, g = generation
  if (!await confirm(`将以版本 ${revision} 为依据保存编辑框的完整内容${raw === '' ? '（空字符串）' : ''}。每人一个槽，成功会替换当前存档；版本冲突不会自动覆盖。是否继续？`, '确认保存存档')) return
  const result = await writes.save(raw, revision)
  if (valid(g) && !result) { current.value = null; state.value = 'stale'; error.value = '保存尚未确认或未完成。请恢复原操作或重新读取当前版本后再决定。' }
}
async function migrate() {
  if (blocked.value || !options.value || state.value !== 'missing') return
  const g = generation
  if (!await confirm('仅复制本人唯一旧存档到尚未建立的新槽；重复旧记录或已有新槽不会覆盖。是否迁移？', '确认迁移旧存档')) return
  const result = await writes.migrate()
  if (valid(g) && !result) { state.value = 'stale'; error.value = '迁移尚未确认或未完成，请恢复原操作或重新读取。' }
}
watch(() => writes.revision, () => { if (mounted) void read() })
watch([() => auth.accessToken, () => auth.account?.oId], () => {
  const next = getAuthContextVersion(), id = auth.account?.oId
  generation++; stopConfirmation(); clearRead()
  if (!auth.accessToken || next !== boundary || id !== owner) { draft.value = ''; options.value = null }
  boundary = next; owner = id; if (mounted) void read()
}, { flush: 'sync' })
onMounted(() => { mounted = true; void read() })
onBeforeUnmount(() => { mounted = false; generation++; stopConfirmation(); clearRead(); draft.value = ''; options.value = null })
</script>

<template>
  <div class="game-saves">
    <h2>游戏云存档</h2><p>Evolve完整存档，每人一个槽。只管理存档，不修改游戏分数；存档内容可复制到对应游戏导入。</p>
    <button type="button" :disabled="loading || confirming" @click="read()">重新读取云存档</button>
    <p v-if="loading" role="status">正在读取存档…</p><p v-if="error" role="alert">{{ error }}</p>
    <p v-if="state === 'missing'">当前没有新存档。可首次保存，或显式迁移本人旧存档。</p>
    <template v-if="current"><p>当前版本 {{ current.revision }} · {{ current.byteLength }} 字节 · {{ new Date(current.updatedAt).toLocaleString('zh-CN') }}</p><p class="save-hash">SHA-256：{{ current.sha256 }}</p><button type="button" :disabled="blocked" @click="loadDraft()">载入当前存档到编辑框</button></template>
    <template v-if="options"><label>Evolve存档原文<textarea v-model="draft" rows="8" :maxlength="options[0]?.maxLength" :disabled="blocked" autocomplete="off" spellcheck="false" /></label><p>最多500000个UTF-16单位、UTF-8最多2MiB。空字符串也可保存；读取和提交不会自动清除编辑框。</p><p>操作结果不确定时请保留页面或使用全局恢复；刷新或退出会丢失仅在内存中的恢复信息。</p><div class="save-actions"><button type="button" :disabled="blocked || !['ready','missing'].includes(state)" @click="save()">保存当前编辑框</button><button v-if="state === 'missing'" type="button" :disabled="blocked" @click="migrate()">迁移本人旧存档</button></div></template>
  </div>
</template>
<style scoped lang="scss">
.game-saves { border-top: 1px solid var(--fp-border); margin-top: 24px; padding-top: 16px; p { overflow-wrap: anywhere; color: var(--fp-muted); } label { display: grid; gap: 8px; margin-top: 14px; } textarea { box-sizing: border-box; width: 100%; resize: vertical; min-width: 0; background: var(--fp-bg); color: var(--fp-text); border: 1px solid var(--fp-border); border-radius: 8px; padding: 10px; } [role=alert] { color: #c65044; } button { padding: 7px 10px; margin: 4px 8px 4px 0; background: var(--fp-card); color: var(--fp-text); border: 1px solid var(--fp-border); border-radius: 7px; cursor: pointer; &:disabled { opacity: .5; cursor: default; } } }
.save-hash { font-size: 12px; } .save-actions { display: flex; flex-wrap: wrap; }
</style>
