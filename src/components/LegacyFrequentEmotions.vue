<script setup lang="ts">
import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { legacyFrequentEmotions } from '@/api/legacy/editor-emojis'
import type { EmojiItem } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore(), items = ref<EmojiItem[]>([]), loading = ref(false), error = ref(''), loaded = ref(false)
let mounted = false, sequence = 0, controller: AbortController | null = null
const identity = () => JSON.stringify([getAuthContextVersion(), auth.apiKey, auth.account?.oId])
function clear() { sequence++; controller?.abort(); controller = null; items.value = []; loading.value = loaded.value = false; error.value = '' }
async function reload() {
  if (!mounted || !auth.apiKey || !auth.account?.oId) return
  clear()
  const actor = identity(), run = sequence, abort = new AbortController()
  controller = abort; loading.value = true
  const current = () => mounted && !abort.signal.aborted && run === sequence && actor === identity()
  try { const rows = await legacyFrequentEmotions(abort.signal); if (current()) { items.value = rows; loaded.value = true } }
  catch (failure) { if (current()) error.value = failure instanceof Error ? failure.message : '常用表情读取失败' }
  finally { if (current()) { loading.value = false; controller = null } }
}
watch(identity, () => { clear(); void reload() }, { flush: 'sync' })
onMounted(() => { mounted = true; void reload() })
onScopeDispose(() => { mounted = false; clear() })
</script>

<template>
  <section class="frequent-emotions" aria-label="当前常用表情">
    <div class="heading"><h3>常用表情</h3><button type="button" :disabled="loading" @click="reload">{{ error ? '重试读取' : '刷新常用表情' }}</button></div>
    <p class="hint">当前账号的常用表情，顺序与编辑器一致。旧版保存依赖经典页面会话，当前仅可查看；v3 模式可编辑。</p>
    <p v-if="loading" role="status">正在读取常用表情…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <template v-else-if="loaded">
      <ul v-if="items.length"><li v-for="(item,index) in items" :key="index"><img v-if="item.url" :src="item.url" :alt="item.name" loading="lazy" /><span v-else class="unicode">{{ item.label }}</span><code>:{{ item.name }}:</code></li></ul>
      <p v-else>暂无常用表情。</p>
    </template>
  </section>
</template>

<style scoped>
.frequent-emotions{border:1px solid var(--fp-border);border-radius:10px;padding:14px}.heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}h3{margin:0;font-size:16px}.hint{color:var(--fp-muted);font-size:13px;line-height:1.7}button{font:inherit;border:1px solid var(--fp-border);border-radius:6px;padding:7px 10px;background:var(--fp-card);color:var(--fp-text);cursor:pointer}button:disabled{opacity:.5;cursor:default}ul{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px}li{display:flex;align-items:center;gap:6px;border:1px solid var(--fp-border);border-radius:6px;padding:6px 9px;max-width:100%;overflow-wrap:anywhere}img,.unicode{width:28px;height:28px;object-fit:contain}.unicode{font-size:22px;text-align:center}code{font-size:12px}[role=alert]{color:var(--danger,#c44)}
</style>
